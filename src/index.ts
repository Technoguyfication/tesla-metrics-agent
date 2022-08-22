import { InfluxDB, Point} from '@influxdata/influxdb-client';

import Config from "./config";
import TeslaApi from "./teslaApi";

async function start() {
	log("Starting...");

	// create influx client
	const influx = new InfluxDB({
		url: Config.influxUrl,
		token: Config.influxToken
	});
	
	const influxWriteApi = influx.getWriteApi(Config.influxOrg, Config.influxBucket);

	// create an instance of the api
	const teslaApi = new TeslaApi(Config.teslaRefreshToken);

	// get vehicles
	const allVehicles = await teslaApi.getVehicles();
	let trackedVehicles: string[];

	// if configured, only track specified vehicles
	if (Config.teslaVehicles.length > 0) {
		trackedVehicles = allVehicles.filter(v => Config.teslaVehicles?.includes(v));
	} else {
		trackedVehicles = allVehicles;
	}

	log(`Logging metrics for ${trackedVehicles.length} of ${allVehicles.length} total vehicles: ${trackedVehicles.join(", ")}`);

	// collection loop
	let retries = 0;
	const maxBackoff = 120;	// 2 minutes
	while (true) {
		const startTime = Date.now();

		// add exponential backoff delay if the last request failed
		if (retries > 0) {
			const backoffSecs = Math.min(Math.pow(2, retries), maxBackoff);
			log(`Last ${retries} attempts failed, backing off for ${backoffSecs}s...`);
			
			await wait(backoffSecs * 1000);
		}

		debugLog("Starting collection cycle");

		try {
			for (let i = 0; i < trackedVehicles.length; i++) {
				const vehicle = trackedVehicles[i];

				debugLog(`Getting data for ${vehicle}`);
				const data = await teslaApi.getData(vehicle);

				// if the vehicle is unavailable, skip it
				if (data === null) {
					debugLog(`Vehicle ${vehicle} unavailable`);
					continue;
				}

				// turn vehicle data into points
				const points: Point[] = [
					new Point("vehicle_data").tag("vehicle", vehicle).tag("vin", data.vin).floatField("battery_level", data.charge_state.battery_level).floatField("battery_range", data.charge_state.battery_range).floatField("odometer", data.vehicle_state.odometer).stringField("state", data.state),
				];

				debugLog(`Writing ${points.length} points for ${vehicle}`);
				influxWriteApi.writePoints(points);
				await influxWriteApi.flush();
			}
		} catch (er) {
			retries++;
			log(`Failed getting data: ${er instanceof Error ? er.stack : er}`);
		}

		debugLog("Collection finished");

		retries = 0;

		// calculate time to wait
		const jitter = -(Config.queryJitter / 2) + (Math.random() * Config.queryJitter);
		const waitTime = Math.max((Config.queryInterval - (Date.now() - startTime) + jitter), 0);
		debugLog(`Waiting ${waitTime}ms`);
		await wait(waitTime);
	}
}

async function wait(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function log(message: string) {
	console.log(message);
}

function debugLog(message: string) {
	if (Config.verbose) {
		console.log(message);
	}
}

start().catch(console.error);
