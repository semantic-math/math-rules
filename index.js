import {defineRule, definePatternRule, canApplyRule, applyRule} from './lib/rule'
import {flattenOperands} from './lib/utils'
import * as rules from './lib/rule-list.js'

export {
    applyRule,
    canApplyRule,
    definePatternRule,
    defineRule,
    flattenOperands,
    rules,
}
