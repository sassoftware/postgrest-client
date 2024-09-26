import { describe, expect, it } from 'vitest';

import { Query } from '../../../src/query';
import DB from '../test-db';

describe('vertical filtering', () => {
  describe('with horizontal filtering', () => {
    const q1 = new Query<DB, 'test_table'>({ tableName: 'test_table' });
    const q2 = new Query<DB, 'test_table2'>({ tableName: 'test_table2' });

    it('simple embedded filters', () => {
      const query = q1.select(['*', q2.eq('id', 1)]);
      expect(query.toObject()).toMatchObject({
        tableName: 'test_table',
        select: ['*', { tableName: 'test_table2', eq: [['id', 1, false]] }],
      });
      expect(query.toString({ encoded: false })).toBe(
        'select=*,test_table2()&test_table2.id=eq.1',
      );

      const queryIn = q1.select(['*', q2.in('id', [1, 2])]);
      expect(queryIn.toObject()).toMatchObject({
        tableName: 'test_table',
        select: [
          '*',
          { tableName: 'test_table2', in: [['id', [1, 2], false]] },
        ],
      });
      expect(queryIn.toString({ encoded: false })).toBe(
        'select=*,test_table2()&test_table2.id=in.(1,2)',
      );
    });

    it('order', () => {
      const query = q1.select(['*', q2.order([{ column: 'id' }])]);
      expect(query.toObject()).toMatchObject({
        tableName: 'test_table',
        select: ['*', { tableName: 'test_table2', order: [{ column: 'id' }] }],
      });
      expect(query.toString({ encoded: false })).toBe(
        'select=*,test_table2()&test_table2.order=id',
      );
    });

    it('order with rename', () => {
      const query = q2.select([
        '*',
        [q1.select('*').order([{ column: 'col1' }]), { name: 'r' }],
      ]);
      expect(query.toString({ encoded: false })).toBe(
        'select=*,r:test_table(*)&r.order=col1',
      );
    });

    it('limit and offset', () => {
      const query = q1.select(['*', q2.limit(10).offset(10)]);
      expect(query.toObject()).toMatchObject({
        tableName: 'test_table',
        select: ['*', { tableName: 'test_table2', limit: 10, offset: 10 }],
      });
      expect(query.toString({ encoded: false })).toBe(
        'select=*,test_table2()&test_table2.limit=10&test_table2.offset=10',
      );
    });

    it('limit and offset with rename', () => {
      const query = q1.select(['*', [q2.limit(10).offset(10), { name: 'r' }]]);
      expect(query.toString({ encoded: false })).toBe(
        'select=*,r:test_table2()&r.limit=10&r.offset=10',
      );
    });

    it('aliased (renamed) embedded filters', () => {
      const query = q1.select([
        '*',
        [q2.select('*').eq('id', 1), { name: 'r1' }],
        [q2.select('*').eq('id', 2), { name: 'r2' }],
      ]);
      expect(query.toString({ encoded: false })).toBe(
        'select=*,r1:test_table2(*),r2:test_table2(*)&r1.id=eq.1&r2.id=eq.2',
      );
    });

    it('multi level nesting', () => {
      const query = q1.select([
        '*',
        q2.select(['*', q1.select('*').eq('id', 1)]),
      ]);
      expect(query.toString({ encoded: false })).toBe(
        'select=*,test_table2(*,test_table(*))&test_table2.test_table.id=eq.1',
      );

      const queryIn = q1.select([
        '*',
        q2.select(['*', q1.select('*').in('id', [1, 2])]),
      ]);
      expect(queryIn.toString({ encoded: false })).toBe(
        'select=*,test_table2(*,test_table(*))&test_table2.test_table.id=in.(1,2)',
      );
    });

    it('multi level nesting with rename', () => {
      const query = q1.select([
        '*',
        [
          q2.select(['*', [q1.select('*').eq('id', 1), { name: 'n2' }]]),
          { name: 'n1' },
        ],
      ]);
      expect(query.toString({ encoded: false })).toBe(
        'select=*,n1:test_table2(*,n2:test_table(*))&n1.n2.id=eq.1',
      );

      const queryIn = q1.select([
        '*',
        [
          q2.select(['*', [q1.select('*').in('id', [1, 2]), { name: 'n2' }]]),
          { name: 'n1' },
        ],
      ]);
      expect(queryIn.toString({ encoded: false })).toBe(
        'select=*,n1:test_table2(*,n2:test_table(*))&n1.n2.id=in.(1,2)',
      );
    });

    it('logical operators', () => {
      const query = q1
        .select(['*', q2.select('*').or((q) => [q.eq('id', 1), q.eq('id', 2)])])
        .or((q) => [q.eq('id', 3), q.eq('id', 4)]);
      expect(query.toString({ encoded: false })).toBe(
        'select=*,test_table2(*)&or=(id.eq.3,id.eq.4)&test_table2.or=(id.eq.1,id.eq.2)',
      );
    });

    it('logical operators with embedded filters (or)', () => {
      const query = q1
        .select(['*', q2.select('*').eq('id', 1)])
        .neq('id', 3)
        .or((q) => [q.gt('id', 2), q.lt('id', 5)]);
      expect(query.toString({ encoded: false })).toBe(
        'select=*,test_table2(*)&id=neq.3&test_table2.id=eq.1&or=(id.gt.2,id.lt.5)',
      );
    });

    it('logical operators with embedded filters (and)', () => {
      const query = q1
        .select(['*', q2.select('*').eq('id', 1)])
        .neq('id', 3)
        .and((q) => [q.gt('id', 2), q.lt('id', 5)]);
      expect(query.toString({ encoded: false })).toBe(
        'select=*,test_table2(*)&id=neq.3&test_table2.id=eq.1&and=(id.gt.2,id.lt.5)',
      );
    });

    it('logical operators with rename', () => {
      const query = q1
        .select([
          '*',
          [
            q2.select('*').or((q) => [q.eq('id', 1), q.eq('id', 2)]),
            { name: 'r' },
          ],
        ])
        .or((q) => [q.eq('id', 3), q.eq('id', 4)]);
      expect(query.toString({ encoded: false })).toBe(
        'select=*,r:test_table2(*)&or=(id.eq.3,id.eq.4)&r.or=(id.eq.1,id.eq.2)',
      );

      const query2 = q1.select([
        '*',
        [
          q2.select('*').or((q) => [q.gt('id', 10), q.in('id', [1, 5])]),
          { name: 'r' },
        ],
      ]);
      expect(query2.toString({ encoded: false })).toBe(
        'select=*,r:test_table2(*)&r.or=(id.gt.10,id.in.(1,5))',
      );
    });

    it('logical operators with not', () => {
      const query = q1.select([
        '*',
        q2.select('*').and((q) => [q.not.eq('id', 1), q.not.in('id', [2, 5])]),
      ]);
      expect(query.toString({ encoded: false })).toBe(
        'select=*,test_table2(*)&test_table2.and=(id.not.eq.1,id.not.in.(2,5))',
      );

      const query2 = q1.select([
        '*',
        q2.select('*').not.or((q) => [q.eq('id', 1), q.in('id', [2, 5])]),
      ]);
      expect(query2.toString({ encoded: false })).toBe(
        'select=*,test_table2(*)&test_table2.not.or=(id.eq.1,id.in.(2,5))',
      );
    });

    describe('top level filtering (!inner)', () => {
      it('simple', () => {
        const query = q1.select(['*', q2.select('*').eq('id', 1).inner()]);
        expect(query.toObject()).toMatchObject({
          tableName: 'test_table',
          select: ['*', { tableName: 'test_table2', eq: [['id', 1, false]] }],
        });
        expect(query.toString({ encoded: false })).toBe(
          'select=*,test_table2!inner(*)&test_table2.id=eq.1',
        );
      });

      it('throws on non-embedded query', () => {
        const query = q1.select('*').inner();
        expect(() => query.toString()).toThrowError();
      });
    });

    describe('top level ordering', () => {
      it('simple', () => {
        const query = q1
          .select(['*', q2.select('*')])
          .order([{ column: 'test_table2.id' }]);
        expect(query.toString({ encoded: false })).toBe(
          'select=*,test_table2(*)&order=test_table2(id)',
        );
      });

      it('simple desc', () => {
        const query = q1
          .select(['*', q2.select('*')])
          .order([{ column: 'test_table2.id', order: 'desc' }]);
        expect(query.toString({ encoded: false })).toBe(
          'select=*,test_table2(*)&order=test_table2(id).desc',
        );
      });

      it('with rename', () => {
        const query = q1
          .select('*')
          .select([q2.select('*'), { name: 't2' }])
          .order([{ column: 't2.id', order: 'desc' }]);
        expect(query.toString({ encoded: false })).toBe(
          'select=*,t2:test_table2(*)&order=t2(id).desc',
        );
      });

      it('with rename (array selector)', () => {
        const query = q1
          .select(['*', [q2.select('*'), { name: 't2' }]])
          .order([{ column: 't2.id', order: 'desc' }]);
        expect(query.toString({ encoded: false })).toBe(
          'select=*,t2:test_table2(*)&order=t2(id).desc',
        );
      });

      it('multiple', () => {
        const query = q1
          .select(['*', q2.select('*')])
          .order([
            { column: 'test_table2.id' },
            { column: 'test_table2.table1_id' },
          ]);
        expect(query.toString({ encoded: false })).toBe(
          'select=*,test_table2(*)&order=test_table2(id),test_table2(table1_id)',
        );
      });

      it('combination', () => {
        const query = q1
          .select(['*', q2.select('*').order([{ column: 'table1_id' }])])
          .order([{ column: 'test_table2.id' }]);
        expect(query.toString({ encoded: false })).toBe(
          'select=*,test_table2(*)&order=test_table2(id)&test_table2.order=table1_id',
        );
      });

      it('multi level nesting', () => {
        const query = q1
          .select('*')
          .select(q2.select('*').select(q1.select('*')))
          .order([
            { column: 'test_table2.id' },
            { column: 'test_table2.test_table.id' },
          ]);
        expect(query.toString({ encoded: false })).toBe(
          'select=*,test_table2(*,test_table(*))&order=test_table2(id),test_table2(test_table(id))',
        );
      });

      it('precedence', () => {
        const query = q1
          .select(['*', q2.select('*')])
          .order([{ column: 'id' }, { column: 'test_table2.id' }]);
        expect(query.toString({ encoded: false })).toBe(
          'select=*,test_table2(*)&order=id,test_table2(id)',
        );

        const query2 = q1
          .select(['*', q2.select('*')])
          .order([{ column: 'test_table2.id' }, { column: 'id' }]);
        expect(query2.toString({ encoded: false })).toBe(
          'select=*,test_table2(*)&order=test_table2(id),id',
        );
      });
    });

    // https://postgrest.org/en/stable/references/api/resource_embedding.html#null-filtering-on-embedded-resources
    it.todo('null filtering');
  });
});
