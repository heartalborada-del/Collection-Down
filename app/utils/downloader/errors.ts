export enum DownloaderErrorEnum {
    AlreadyExists = "Download Item Already Exists.",
    NetworkError = "Network Error Occurred During Download.",
}

export class DownloadError extends Error {
    override name: DownloaderErrorEnum;
    override message: string;

    constructor(type: DownloaderErrorEnum) {
        super();
        this.name = type;
        this.message = type.toString();
    }
}