// TODO: handle op being an identifier or other nodes, e.g. pow where exp = -1
export function applyNode(op, args, loc, options = {}) {
    return {
        type: 'Apply',
        op: op,
        args: args,
        loc: loc || {
            start: args[0].loc.start,
            end: args[args.length - 1].loc.end,
        },
        ...options,
    }
}

export function identifierNode(name, start, end) {
    return {
        type: 'Identifier',
        name: name,
        loc: {start, end},
        // TODO: add subscript
    }
}

export function numberNode(value, start, end) {
    return {
        type: 'Number',
        value: value,
        loc: {start, end},
    }
}

export function parensNode(body, start, end) {
    return {
        type: 'Parentheses',
        loc: {start, end},
        body: body
    }
}


export const isAdd = node => node && node.type === 'Apply' && node.op === 'add'
export const isIdentifier = node => node.type === 'Identifier'
export const isNeg = node => node.type === 'Apply' && node.op === 'neg'
export const isNumber = node => {
    if (node.type === 'Number') {
        return true
    } else if (isNeg(node)) {
        return isNumber(node.args[0])
    } else {
        return false
    }
}

export const getValue = node => {
    if (node.type === 'Number') {
        return parseFloat(node.value)
    } else if (isNeg(node)) {
        return -getValue(node.args[0])
    }
}
