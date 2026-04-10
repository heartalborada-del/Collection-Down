export type DownloadItem = {
    Url: string;
    FileFullDirectory: string;
    OnProgress?: (loaded: number, total: number) => void;
    OnFailed?: (error: unknown) => void;
    OnSuccess?: () => void;
}