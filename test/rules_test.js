import assert from 'assert'; import {parse, print} from 'math-parser'; import * as nodes from 
'../lib/nodes'; import {applyRule} from '../lib/matcher.js'; import rules from 
'../lib/rules.js'; const applyRuleString = (rule, input) => print(applyRule(rule, 
parse(input))); describe('applyRules', () => {
  it('negation', () => {
    assert.equal(applyRuleString(rules.NEGATION, '--x'), 'x');
  });
  it('division by negative one', () => {
    assert.equal(applyRuleString(rules.DIVISION_BY_NEGATIVE_ONE, '2 / -1'), '-2');
  });
  it('division by one', () => {
    assert.equal(applyRuleString(rules.DIVISION_BY_ONE, '2 / 1'), '2');
  });
  it('multiply by zero', () => {
    assert.equal(applyRuleString(rules.MULTIPLY_BY_ZERO, '2 * 0'), '0');
  });
  it('reduce exponent by zero', () => {
    assert.equal(applyRuleString(rules.REDUCE_EXPONENT_BY_ZERO, '2 ^ 0'), '1');
  });
  it('reduce zero numerator', () => {
    assert.equal(applyRuleString(rules.REDUCE_ZERO_NUMERATOR, '0 / 2'), '0');
  });
  it('remove adding zero', () => {
    assert.equal(applyRuleString(rules.REMOVE_ADDING_ZERO, '2 + 0'), '2');
  });
  it('remove exponent by one', () => {
    assert.equal(applyRuleString(rules.REMOVE_EXPONENT_BY_ONE, '2 ^ 1'), '2');
  });
  it('remove exponent by base one', () => {
    assert.equal(applyRuleString(rules.REMOVE_EXPONENT_BASE_ONE, '1 ^ 2'), '1');
  });
  it('remove multiplying by negative one', () => {
    assert.equal(applyRuleString(rules.REMOVE_MULTIPLYING_BY_NEGATIVE_ONE, '2 * -1'), '-2');
  });
  it('remove multiplying by one', () => {
    assert.equal(applyRuleString(rules.REMOVE_MULTIPLYING_BY_ONE, '2 * 1'), '2');
  });
  /*
  it('resolve double minus', () => {
    assert.equal(applyRuleString(rules.RESOLVE_DOUBLE_MINUS, '2 - -1'), '2 + 1');
  });
  it('multiplying negatives', () => {
    assert.equal(applyRuleString(rules.MULTIPLY_NEGATIVES, '-2 * -1'), '2 * 1');
  });
  */
  it('remove multiplying by negative one', () => {
    assert.equal(applyRuleString(rules.REMOVE_MULTIPLYING_BY_NEGATIVE_ONE, '2 * -1'), '-2');
  });
  /*
  it('cancel minuses', () => {
    assert.equal(applyRuleString(rules.CANCEL_MINUSES, '-2 / -1'), '2 / 1');
  });
  it('simplify signs', () => {
    assert.equal(applyRuleString(rules.SIMPLIFY_SIGNS, '2 / -1'), '-2 / 1');
  });
  */
  
  //doesn't register parenthesis?
  /*
  it('multiply fractions', () => {
    assert.equal(applyRuleString(rules.MULTIPLY_FRACTIONS, '3 / 2 * 2 / 3'), '(3 * 2) / (2 * 
3)');
  });
  it('simplfy division', () => {
    assert.equal(applyRuleString(rules.SIMPLIFY_DIVISION, '2 / 3 / 4'), '2 / (3 * 4)');
  });
  it('multiply by inverse', () => {
    assert.equal(applyRuleString(rules.MULTIPLY_BY_INVERSE, '2 / (3 / 4)'), '2 * (4 / 3)');
  });
  */
  /*
  it('absolute value', () => {
    assert.equal(applyRuleString(rules.ABSOLUTE_VALUE, '|-2|'), '2');
  });
  */
});
