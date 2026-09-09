/// <reference types="jest" />
import {
  MEMBER_CARD_ROLE_LABEL,
  memberCardRoleFromDependant,
  memberCardRoleFromParent,
} from '../member-card-role.util';

describe('member-card-role.util', () => {
  it('maps dependant and parent relationships to card roles', () => {
    expect(memberCardRoleFromDependant('SPOUSE')).toBe('SPOUSE');
    expect(memberCardRoleFromDependant('CHILD')).toBe('CHILD');
    expect(memberCardRoleFromParent('MOTHER')).toBe('PARENT');
    expect(memberCardRoleFromParent('FATHER')).toBe('PARENT');
    expect(MEMBER_CARD_ROLE_LABEL.PRINCIPAL).toBe('Principal');
    expect(MEMBER_CARD_ROLE_LABEL.PARENT).toBe('Parent');
  });
});
