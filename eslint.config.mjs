import coreWebVitals from "eslint-config-next/core-web-vitals";
import tsConfig from "eslint-config-next/typescript";

const config = [...coreWebVitals, ...tsConfig];

export default config;
