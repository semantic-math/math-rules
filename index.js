import {defineRule, definePatternRule, canApplyRule, applyRule} from './lib/matcher'
import {flattenOperands} from './lib/utils'
import * as simple_rules from './lib/simple-rules.js'
import * as factor_rules from './lib/factor-rules.js'

export {
    applyRule,
    canApplyRule,
    definePatternRule,
    defineRule,
    flattenOperands,
    simple_rules,
    factor_rules,
}
