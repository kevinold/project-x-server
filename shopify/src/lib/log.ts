const logLevels: { [pname: string]: number } = {
    DEBUG: 0,
    ERROR: 3,
    INFO: 1,
    WARN: 2,
};

export class Log {
    public static debug(message?: any, ...optionalParams: any[]) {
        const logLevel = logLevels[process.env.LOGGING || "WARN"];

        if (logLevel && logLevel <= logLevels.DEBUG) {
            console.debug(message, ...optionalParams);
        }
    }
    public static error(message?: any, ...optionalParams: any[]) {
        const logLevel = logLevels[process.env.LOGGING || "WARN"];

        if (logLevel && logLevel <= logLevels.ERROR) {
            console.error(message, ...optionalParams);
        }
    }

    public static info(message?: any, ...optionalParams: any[]) {
        const logLevel = logLevels[process.env.LOGGING || "WARN"];

        if (logLevel && logLevel <= logLevels.INFO) {
            console.info(message, ...optionalParams);
        }
    }

    public static warn(message?: any, ...optionalParams: any[]) {
        const logLevel = logLevels[process.env.LOGGING || "WARN"];

        if (logLevel && logLevel <= logLevels.WARN) {
            console.warn(message, ...optionalParams);
        }
    }
}
