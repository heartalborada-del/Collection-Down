export class ApiResponse<T> {
    code: number;
    message?: string;
    data?: T;

    constructor(code: number = 0, message?: string, data?: T) {
        this.code = code;
        this.message = message;
        this.data = data;
    }
}