export class HTTPError extends Error {
    constructor(
        public readonly status: number,
        message = "HTTP request failed",
    ) {
        super(message);
        this.name = "HTTPError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
