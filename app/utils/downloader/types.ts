export type DownloadItem = {
    Url: string;
    OnProgress?: (loaded: number, total: number) => void;
    OnFailed?: (error: any) => void;
    OnSuccess?: (data: Blob) => void;
}