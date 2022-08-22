type Config = {
	teslaRefreshToken: string;
	teslaVehicles: string[];
	teslaForceWake: boolean;
	teslaTokenTtl: number;
	teslaApiUrl: string;
	teslaAuthUrl: string;

	influxUrl: string;
	influxToken: string;
	influxOrg: string;
	influxBucket: string;

	verbose: boolean;

	queryInterval: number;
	queryJitter: number;
	cacheTokens: boolean;
};

function readConfig(): Config {
	const teslaRefreshToken = process.env["TESLA_REFRESH_TOKEN"];
	if (!teslaRefreshToken) throw new Error("TESLA_REFRESH_TOKEN environment variable is not set");

	const teslaVehiclesStr = process.env["TESLA_VEHICLES"];
	let teslaVehicles: string[];
	if (teslaVehiclesStr && teslaVehiclesStr?.length > 0) {
		teslaVehicles = teslaVehiclesStr?.split(",");
	} else {
		teslaVehicles = [];
	}

	const teslaForceWake = process.env["TESLA_FORCE_WAKE"] === "true";

	const teslaTokenTtl = parseInt(process.env["TESLA_TOKEN_TTL"] ?? "14400");
	const teslaApiUrl = process.env["TESLA_API_URL"] ?? "https://owner-api.teslamotors.com/";
	const teslaAuthUrl = process.env["TESLA_AUTH_URL"] ?? "https://auth.tesla.com/";

	const influxUrl = process.env["INFLUXDB_URL"];
	if (!influxUrl) throw new Error("INFLUXDB_URL environment variable is not set");

	const influxToken = process.env["INFLUXDB_TOKEN"];
	if (!influxToken) throw new Error("INFLUXDB_TOKEN environment variable is not set");

	const influxOrg = process.env["INFLUXDB_ORG"];
	if (!influxOrg) throw new Error("INFLUXDB_ORG environment variable is not set");

	const influxBucket = process.env["INFLUXDB_BUCKET"];
	if (!influxBucket) throw new Error("INFLUXDB_BUCKET environment variable is not set");

	const verbose = process.env["VERBOSE"] === "true";

	const queryInterval = parseInt(process.env["QUERY_INTERVAL"] ?? "10000");
	const queryJitter = parseInt(process.env["QUERY_JITTER"] ?? "500");
	const cacheTokens = process.env["CACHE_TOKENS"] === "true";

	return {
		teslaRefreshToken,
		teslaVehicles,
		teslaForceWake,
		teslaTokenTtl,
		teslaApiUrl,
		teslaAuthUrl,
		influxUrl,
		influxToken,
		influxOrg,
		influxBucket,
		verbose,
		queryInterval,
		queryJitter,
		cacheTokens
	};
}

const Config = readConfig();
export default Config;
