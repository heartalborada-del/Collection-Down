export type DownloadItem = {
    RelativePath: string;
    Url: string;
    OnProgress?: (loaded: number, total: number) => void;
    OnFailed?: (error: any) => void;
}