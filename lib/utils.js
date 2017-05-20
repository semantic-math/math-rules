import {build, query} from 'math-nodes'
import {replace, traverse} from 'math-traverse'

export const clone = node => JSON.parse(JSON.stringify(node))

export const checkBounds = (indexes, array) =>
    indexes.start > 0 || indexes.end < array.length

export const getPlaceholders = (ast) => {
    const placeholders = {}
    traverse(ast, {
        leave(node) {
            if (node.type === 'Placeholder') {
                placeholders[node.name] = node
            }
        }
    })
    return placeholders
}

const hasPlaceholderWithSubscript = (ast) => {
    let result = false
    traverse(ast, {
        leave(node) {
            if (result) {
                return
            } else if (node.type === 'Placeholder' &&
                       node.subscript &&
                       query.isNumber(node.subscript) &&
                       query.getValue(node.subscript) === 0) {
                result = true
            }
        }
    })
    return result
}

export const isVariableLengthPattern = (pattern) => {
    // TODO: also check if:
    // - pattern.args[0] has a pattern with a subscript anywhere it its tree
    // - that the subscript is the number 0
    return pattern.type === 'Apply' && pattern.args.length === 2
        && pattern.args[1].type === 'Ellipsis'
        && hasPlaceholderWithSubscript(pattern.args[0])
}

export const fixMinuses = (ast) => {
    const path = []
    return replace(ast, {
        enter(node) {
            path.push(node)
        },
        leave(node) {
            path.pop()
            const parent = path[path.length - 1]

            if (query.isAdd(parent)) {
                if (query.isDiv(node)) {
                    // 1 + -a / b -> 1 - a / b
                    if (query.isNeg(node.args[0]) && node.args[0].wasMinus) {
                        node.args[0] = node.args[0].args[0]
                        // TODO: update build.applyNode to not need loc
                        return {
                            type: 'Apply',
                            op: 'neg',
                            args: [node],
                            wasMinus: true,
                        }
                    }
                } else if (query.isMul(node)) {
                    // 1 + a * -b -> 1 - a * b
                    for (let i = 0; i < node.args.length; i++) {
                        const arg = node.args[i]
                        if (query.isNeg(arg) && arg.wasMinus) {
                            node.args[i] = node.args[i].args[0]
                            // TODO: update build.applyNode to not need loc
                            return {
                                type: 'Apply',
                                op: 'neg',
                                args: [node],
                                wasMinus: true,
                            }
                        }
                    }
                }
            }
        }
    })
}

export const getRanges = (args, predicate) => {
    const ranges = []
    let i
    let start = -1
    for (i = 0; i < args.length; i++) {
        if (predicate(args[i])) {
            if (start === -1) {
                start = i
            }
        } else {
            if (start !== -1 && i - start > 1) {
                ranges.push([start, i])
            }
            start = -1
        }
    }
    if (start !== -1 && i - start > 1) {
        ranges.push([start, i])
    }
    return ranges
}
