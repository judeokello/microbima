import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "Maisha Poa Agent Registration",
  version: packageJson.version,
  copyright: `© ${currentYear}, Maisha Poa.`,
  meta: {
    title: "Maisha Poa Agent Registration",
    description:
      "Maisha Poa Agent Registration is a platform for registering agents for Maisha Poa.",
  },
};
