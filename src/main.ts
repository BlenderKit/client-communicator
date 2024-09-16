export { downloadAssetToSoftware, getRunningClients, onLoad };

/** As defined in CLIENT_PORTS in https://github.com/BlenderKit/BlenderKit/blob/main/global_vars.py */
let CLIENT_PORTS = ["65425", "55428", "49452", "35452", "25152", "5152", "1234", "62485"];

interface ClientStatus {
    clientVersion: string; // e.g. 1.2.1
    softwares: Software[]; // List of connected softwares with communicating add-ons
}

interface Software {
    name: string; // Blender/Godot/etc.
    version: string; // Version of the software, e.g. 4.2.1
    appID: number; // PID aka Process ID
    addonVersion: string; // Version of the add-on, e.g. 3.12.2
}

async function clientIsOnline(): Promise<boolean> {
    const resp = await getRunningClients();
    return resp!== null;
}

/** Iterate over all possible ports Client can have on the localhost and get their ClientStatuses if possible.
 * Use the statuses to update UI and inform user where they can download the asset from browser gallery.
 * @returns first successful response from local Client or null if something went wrong.
 */
async function getRunningClients(): Promise<ClientStatus[]> {
    let statuses: ClientStatus[] = []
    for (const port of CLIENT_PORTS) {
        const clientStatus = await _tryClientStatus(`http://localhost:${port}/bkclientjs/status`)
        if (clientStatus === null) {
            continue
        }
        statuses.push(clientStatus);
    }
    return statuses;
}

/** Try to get the ClientStatus on selected address. This can fail as we are not sure if Client is available there.
 * Returns the status if Client runs on the URL, or null if the request has failed or response is not OK (could be another software running there).
 * @param url Address where to check if Client replies
 * @returns response of the Client or null if something went wrong
 */
async function _tryClientStatus(url: string): Promise<ClientStatus|null> {
    let clientStatus: ClientStatus
    try {
        const resp = await fetch(url);
        if (resp.status !== 200) {
            console.log(`Wrong status code: ${resp.status}`);
            return null;
        }
        console.log("Client response:", resp)
        clientStatus = await resp.json() as ClientStatus;
    } catch (err) {
        console.error("Error getting response:", err);
        return null;
    }

    if (clientStatus.softwares === null) {
        clientStatus.softwares = []
    }
    return clientStatus
}


/** Schedule download of an Asset to specified Software.
 * @param clientPort - port on which the Client is running (there can be multiple Clients in rare cases)
 * @param assetID - which asset to download
 * @param assetBaseID - which asset to download TODO: remove this or assetBaseID and require just one
 * @param resolution - resolution of the asset - user should probably select this in the gallery
 * @param apiKey - apiKey of the logged user on the webpage - no need to sync the keys between several softwares
 * @param appID - Process ID of the running software to which we will download - list of all softwares is part of the 
 * @returns true if download was successfully scheduled, otherwise false.
 */
async function downloadAssetToSoftware (clientPort: string, assetID: string, assetBaseID: string, resolution: string, apiKey: string, appID: number): Promise<boolean> {
    /** Defined in bkclientjsStatusHandler in https://github.com/BlenderKit/BlenderKit/blob/main/client/main.go. */
    const url = `http://localhost:${clientPort}/bkclientjs/get_asset`;
    const data = JSON.stringify({
        "api_key": apiKey,
        "asset_id": assetID,
        "asset_base_id": assetBaseID,
        "resolution": resolution,
        "app_id": Number(appID),
    });

    try {
        const resp = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: data,
        });
        if (resp.status === 200) {
            return true;
        }
    }
    catch (err) {
        console.error(err);
    }

    return false;
}

async function onLoad() {
    const clientStatuses = await getRunningClients();
    if (clientStatuses === null) {
        return;
    }
    console.log("Clients available:", clientStatuses)
    for(let i=0; i<clientStatuses.length; i++) {
        console.log(`${i}. Client (version=${clientStatuses[i].clientVersion})`);   
        for(let x=0; x<clientStatuses[i].softwares.length; x++){
            console.log(`- ${x}. Software: ${clientStatuses[i].softwares[x]}`);
        };
    };
}
