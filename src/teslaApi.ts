import { AxiosError, AxiosResponse, default as axios } from "axios";
import Config from "./config";

type TeslaToken = {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
};

type TeslaData = {
	state: string;

	drive_state: {
		heading: number;
		latitude: number;
		longitude: number;
		speed: number | null;
		power: number;

	}

	charge_state: {
		battery_level: number;

		/** Battery range as determined by vehicle's EPA rating */
		battery_range: number;

		/** Battery range as determined by vehicle's actual range */
		est_battery_range: number;

		/** Current charging state of the vehicle */
		charging_state: string;

		/** The configured current for the charge limit */
		charge_amps: number;

		/** Charge rate in mph */
		charge_rate: number;

		charger_voltage: number;
		charger_actual_current: number;
		charger_power: number;
		charger_phases: number;
		charge_limit_soc: number;

		/** Minutes to reach requested SOC */
		minutes_to_full_charge: number;

		/** Hours to reach requested SOC */
		time_to_full_charge: number;
	}

	climate_state: {
		inside_temp: number;
		outside_temp: number;
		driver_temp_setting: number;
		passenger_temp_setting: number;
	}

	vehicle_state: {
		odometer: number;
	}
	
	vin: string;
};

export default class TeslaApi {
	private _token: TeslaToken | null = null;
	private _refreshToken: string;

	constructor(refreshToken: string) {
		this._refreshToken = refreshToken;
	}

	/**
	 * Retrieves the latest vehicle data, or null if the vehicle is unavailable
	 * */
	async getData(vehicleId: string): Promise<TeslaData | null> {
		const response = await this.apiRequest("GET", `api/1/vehicles/${vehicleId}/vehicle_data`);
		
		switch (response.status) {
			case 200:
				return response.data["response"];
			case 408:
				return null;	// vehicle unavailable
			default:
				throw new Error(`Unexpected response: ${response.status}`);
		}
	}

	async getVehicles(): Promise<string[]> {
		const response = await this.apiRequest("GET", "api/1/vehicles");

		if (response.status !== 200) throw new Error(`Unexpected response: ${response.status}`);

		const vehicles: { id_s: string}[] = response.data["response"];
		return vehicles.map(v => v.id_s);
	}

	private async apiRequest(method: string, endpoint: string): Promise<AxiosResponse> {
		// refresh token if necessary
		if (!this._token || this._token.expiresAt < (Date.now() - (Config.teslaTokenTtl * 1000))) {
			this._token = await this.getAccessToken();
		}

		return await axios(Config.teslaApiUrl + endpoint, {
			method: method,
			validateStatus: (status) => (status >= 200 && status < 300) || (status >= 400 && status < 500),	// only accept 2xx and 4xx responses
			headers: {
				Authorization: `Bearer ${this._token.accessToken}`
			}
		});
	}

	/**
	* Exchanges refresh token for an access token through the Tesla API.
	* */
	private async getAccessToken(): Promise<TeslaToken> {
		const response = await axios.post(`${Config.teslaAuthUrl}oauth2/v3/token`, {
			grant_type: "refresh_token",
			client_id: "ownerapi",
			refresh_token: this._refreshToken,
			scope: "openid email offline_access"
		});

		return {
			accessToken: response.data["access_token"],
			refreshToken: response.data["refresh_token"],
			expiresAt: Date.now() + (parseInt(response.data["expires_in"]) * 1000)
		};
	}
}