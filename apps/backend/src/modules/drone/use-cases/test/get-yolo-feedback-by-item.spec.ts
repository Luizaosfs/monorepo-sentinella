import { GetYoloFeedbackByItem } from '../get-yolo-feedback-by-item';

describe('GetYoloFeedbackByItem', () => {
  let uc: GetYoloFeedbackByItem;
  let findFirst: jest.Mock;

  beforeEach(() => {
    findFirst = jest.fn().mockResolvedValue(null);
    uc = new GetYoloFeedbackByItem({ client: { yolo_feedback: { findFirst } } } as never);
  });

  it('returns null feedback when not found', async () => {
    const result = await uc.execute('item-1', 'cli-1');
    expect(result).toEqual({ feedback: null });
  });

  it('filters by both levantamentoItemId and clienteId (IDOR)', async () => {
    await uc.execute('item-1', 'cli-1');
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { levantamento_item_id: 'item-1', cliente_id: 'cli-1' },
    }));
  });

  it('returns feedback when found', async () => {
    const fb = { id: 'fb-1', confirmado: true };
    findFirst.mockResolvedValue(fb);
    const result = await uc.execute('item-1', 'cli-1');
    expect(result.feedback).toEqual(fb);
  });
});
