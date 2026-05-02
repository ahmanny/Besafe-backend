import axios from "axios";

const AI_BASE_URL = process.env.AI_BASE_URL ?? "https://besafev1.onrender.com";
const THREAT_THRESHOLD = 0.75; // trigger SOS above this confidence

type AIPredictResponse = {
    prediction: string;
    confidence: number;
    model_version: string;
};

type AnalyzeResult = {
    prediction: string;
    confidence: number;
    model_version: string;
    shouldTriggerSOS: boolean;
};

class SafetyServiceClass {
    constructor() {
        // super()
    }

    public async analyzeText(text: string, userId: string): Promise<AnalyzeResult> {

        console.log("client text", text)
        // call AI model
        const { data } = await axios.post<AIPredictResponse>(
            `${AI_BASE_URL}/predict/`,
            { text }
        );

        const shouldTriggerSOS =
            data.prediction.toLowerCase() === "threat" &&
            data.confidence >= THREAT_THRESHOLD;

        // log to DB if threat detected
        if (shouldTriggerSOS) {
            await this.logThreatIncident(userId, {
                text,
                prediction: data.prediction,
                confidence: data.confidence,
                modelVersion: data.model_version,
            });
        }

        console.log("Threat Level", {
            prediction: data.prediction,
            confidence: data.confidence,
            model_version: data.model_version,
            shouldTriggerSOS,
        })
        return {
            prediction: data.prediction,
            confidence: data.confidence,
            model_version: data.model_version,
            shouldTriggerSOS,
        };
    }

    private async logThreatIncident(
        userId: string,
        payload: {
            text: string;
            prediction: string;
            confidence: number;
            modelVersion: string;
        }
    ) {
        // TODO: save to ThreatLog model when you build it
        console.log(`[THREAT] user=${userId}`, payload);
    }

}

export const SafetyService = new SafetyServiceClass();