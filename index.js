import {defineRule, definePatternRule, canApplyRule, applyRule} from './lib/matcher'
import {flattenOperands} from './lib/utils'
import * as rules from './lib/rules.js'

export {
    applyRule,
    canApplyRule,
    definePatternRule,
    defineRule,
    flattenOperands,
    rules,
}
