// utils/rangeValidator.ts

export interface Range {
    start: number
    end: number
}

export interface RangeValidationOptions {
    /**
     * 最大允许的范围大小（字节）
     */
    maxRangeSize?: number
    /**
     * 当范围超过最大限制时的处理方式
     */
    onExceedMax?: 'clamp' | 'throw' | 'return-null'
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class RangeValidator {
    /**
     * 校验 Range 是否超过原大小和最大范围限制
     * @param range 要校验的范围
     * @param totalLength 文件总大小
     * @param options 校验选项
     * @returns 校验后的范围或 null
     */
    static validateRange(
        range: Range,
        totalLength: number,
        options: RangeValidationOptions = {}
    ): Range | null {
        const defaultOptions: RangeValidationOptions = {
            maxRangeSize: 10 * 1024 * 1024, // 默认 10MB
            onExceedMax: 'clamp'
        }
        const opts = { ...defaultOptions, ...options }

        // 检查范围是否超过文件大小
        if (range.start >= totalLength) {
            // 起始位置超过文件大小，返回无效
            return null
        }

        // 如果结束位置超过文件大小，修正为文件末尾
        let end = range.end
        if (end >= totalLength) {
            end = totalLength - 1
        }

        // 计算范围大小
        const rangeSize = end - range.start + 1

        // 检查是否超过最大范围限制
        if (rangeSize > opts.maxRangeSize! && opts.maxRangeSize && opts.maxRangeSize > 0) {
            switch (opts.onExceedMax) {
                case 'throw':
                    throw new Error(`Range size ${rangeSize} exceeds maximum allowed size ${opts.maxRangeSize}`)

                case 'return-null':
                    return null

                case 'clamp':
                default:
                    // 修正结束位置，使其不超过最大范围
                    end = range.start + opts.maxRangeSize! - 1
                    // 确保不会超过文件大小
                    if (end >= totalLength) {
                        end = totalLength - 1
                    }
            }
        }

        return {
            ...range,
            end
        }
    }

    /**
     * 批量校验多个范围
     */
    static validateRanges(
        ranges: Range[],
        totalLength: number,
        options: RangeValidationOptions = {}
    ): Range[] {
        const validatedRanges: Range[] = []

        for (const range of ranges) {
            const validated = this.validateRange(range, totalLength, options)
            if (validated) {
                validatedRanges.push(validated)
            }
        }

        return validatedRanges
    }

    /**
     * 检查单个范围是否有效
     */
    static isRangeValid(range: Range, totalLength: number, maxRangeSize?: number): boolean {
        if (range.start < 0 || range.start >= totalLength || range.end < range.start) {
            return false
        }

        const rangeSize = range.end - range.start + 1
        if (maxRangeSize && rangeSize > maxRangeSize) {
            return false
        }

        return true
    }
}