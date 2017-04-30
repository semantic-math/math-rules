import {parse, print} from 'math-parser';

import {defineRule} from '../lib/matcher';

const defineRuleString = (matchPattern, rewritePattern, constraints) => {
  return defineRule(
    parse(matchPattern),
    parse(rewritePattern),
    constraints);
};


// NEGATION
// e.g. -(-3) -> 3 
const NEGATION = defineRuleString('--#a', '#a');

// ARITHMETIC
// e.g. 2/-1 -> -2
const DIVISION_BY_NEGATIVE_ONE = defineRuleString('#a / -1', '-#a');

// e.g. 2/1 -> 2
const DIVISION_BY_ONE = defineRuleString('#a / 1', '#a');

// e.g. x * 0 -> 0
const MULTIPLY_BY_ZERO = defineRuleString('#a * 0', '0');

// e.g. x ^ 0 -> 1
const REDUCE_EXPONENT_BY_ZERO = defineRuleString('#a ^ 0', '1');

// e.g. 0/1 -> 0
const REDUCE_ZERO_NUMERATOR = defineRuleString('0 / #a', '0');

// e.g. 2 + 0 -> 2
const REMOVE_ADDING_ZERO = defineRuleString('#a + 0', '#a');

// e.g. x ^ 1 -> x
const REMOVE_EXPONENT_BY_ONE = defineRuleString('#a ^ 1', '#a');

// e.g. 1 ^ x -> 1
const REMOVE_EXPONENT_BASE_ONE = defineRuleString('1 ^ #a', '1');

// e.g. x * -1 -> -x
const REMOVE_MULTIPLYING_BY_NEGATIVE_ONE = defineRuleString('#a * -1', '-#a');

// e.g. x * 1 -> x
const REMOVE_MULTIPLYING_BY_ONE = defineRuleString('#a * 1', '#a');

// e.g. 2 - - 3 -> 2 + 3
const RESOLVE_DOUBLE_MINUS = defineRuleString('#a - -#b', '#a + #b');

// e.g -3 * -2 -> 3 * 2
const MULTIPLY_NEGATIVES = defineRuleString('-#a * -#b', '#a * #b');

// FRACTIONS

// e.g. -2/-3 => 2/3
const CANCEL_MINUSES = defineRuleString('-#a / -#b', '#a / #b');

// e.g. 2/-3 -> -2/3
const SIMPLIFY_SIGNS = defineRuleString('#a / -#b', '-#a / #b');

// MULTIPLYING FRACTIONS

// e.g. 1/2 * 2/3 -> 2/3
const MULTIPLY_FRACTIONS = defineRuleString('#a / #b * #c / #d', '(#a * #c) / (#b * #d)');

// DIVISION

// e.g. 2/3/4 -> 2/(3*4)
const SIMPLIFY_DIVISION = defineRuleString('#a / #b / #c', '#a / (#b * #c)');

// e.g. x/(2/3) -> x * 3/2
const MULTIPLY_BY_INVERSE = defineRuleString('#a / (#b / #c)', '#a * (#c / #b)');

// ABSOLUTE
// e.g. |-3| -> 3
const ABSOLUTE_VALUE = defineRuleString('|-#a|', '#a');

module.exports = {
  NEGATION,
  DIVISION_BY_NEGATIVE_ONE,
  DIVISION_BY_ONE,
  MULTIPLY_BY_ZERO,
  REDUCE_EXPONENT_BY_ZERO,
  REDUCE_ZERO_NUMERATOR,
  REMOVE_ADDING_ZERO,
  REMOVE_EXPONENT_BY_ONE,
  REMOVE_EXPONENT_BASE_ONE,
  REMOVE_MULTIPLYING_BY_NEGATIVE_ONE,
  REMOVE_MULTIPLYING_BY_ONE,
  RESOLVE_DOUBLE_MINUS,
  MULTIPLY_NEGATIVES,
  CANCEL_MINUSES,
  SIMPLIFY_SIGNS,
  MULTIPLY_FRACTIONS,
  SIMPLIFY_DIVISION,
  MULTIPLY_BY_INVERSE,
  ABSOLUTE_VALUE
};
