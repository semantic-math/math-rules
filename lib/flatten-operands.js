import {replace} from 'math-traverse'
import {query} from 'math-nodes'

export default (ast) => {
    return replace(ast, {
        leave(node) {
            if (query.isAdd(node)) {
                let i = 0
                while (i < node.args.length) {
                    const arg = node.args[i]
                    if (query.isAdd(arg)) {
                        node.args.splice(i, 1, ...arg.args)
                        i += arg.args.length
                    } else {
                        i++
                    }
                }
            } else if (query.isMul(node)) {
                let i = 0
                while (i < node.args.length) {
                    const arg = node.args[i]
                    if (query.isMul(arg)) {
                        node.args.splice(i, 1, ...arg.args)
                        i += arg.args.length
                    } else {
                        i++
                    }
                }
            }
        }
    })
}
