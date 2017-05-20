import {parse, print} from 'math-parser'
import {build, query} from 'math-nodes'
import {canApplyRule} from '../matcher.js'
import flattenOperands from '../flatten-operands.js'
import {defineRule, populatePattern} from '../matcher'

const clone = node => JSON.parse(JSON.stringify(node))
const populatePatternString = (pattern, placeholders) => populatePattern(parse(pattern), placeholders)

export const COMMON_DENOMINATOR = defineRule(
    (node) => {
        console.log(node);
    },

    (node) => {
        
    }
)
