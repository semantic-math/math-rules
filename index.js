import {defineRule, definePatternRule, canApplyRule, applyRule, rewriteNode} from './lib/rule'
import {flattenOperands} from './lib/utils'
import * as simple_rules from './lib/simple-rules.js'
import * as factor_rules from './lib/factor-rules.js'

export {
    applyRule,
    canApplyRule,
    definePatternRule,
    defineRule,
    rewriteNode,
    flattenOperands,
    simple_rules,
    factor_rules,
}
