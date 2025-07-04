import { Mastra } from "@mastra/core";
import { PinoLogger } from "@mastra/loggers";
import { weatherAgent } from "./agents/weather-agent/weather-agent"; // This can be deleted later
import { weatherWorkflow } from "./agents/weather-agent/weather-workflow"; // This can be deleted later
import { nosanaAgent } from "./agents/nosana-agent/nosana-agent";
import { nosanaWorkflow } from "./agents/nosana-agent/nosana-workflow";

export const mastra = new Mastra({
	workflows: { weatherWorkflow, nosanaWorkflow },
	agents: { weatherAgent, nosanaAgent },
	logger: new PinoLogger({
		name: "Mastra",
		level: "info",
	}),
	server: {
		port: 8080,
		timeout: 10000,
	},
});
