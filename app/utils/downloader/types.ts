export type DownloadItem = {
    Url: string;
    Urls?: string[];
    FileFullDirectory: string;
    OnProgress?: (loaded: number, total: number) => void;
    OnFailed?: (error: unknown) => void;
    OnSuccess?: () => void;
}
