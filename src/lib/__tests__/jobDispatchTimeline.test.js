import { describe, expect, it } from 'vitest'
import {
  buildDispatchTimelineState,
  buildStepTimestampsFromHistory,
  historyStatusToTimelineStepId,
} from '../jobDispatchTimeline'

describe('buildDispatchTimelineState', () => {
  const baseQuote = {
    id: 'q1',
    assigned_at: '2026-05-28T10:00:00Z',
    assigned_driver_id: 'd1',
    assigned_driver_name: 'Driver One',
  }

  it('highlights On way after pickup Start', () => {
    const steps = buildDispatchTimelineState(
      baseQuote,
      {},
      null,
      { status: 'on_way' },
      { workflow_status: 'on_way', workflow_at: '2026-05-28T11:00:00Z' },
    )
    expect(steps.find((s) => s.id === 'on_way')?.state).toBe('current')
    expect(steps.find((s) => s.id === 'arrived_pickup')?.state).toBe('upcoming')
  })

  it('highlights Arrived after pickup Arrived', () => {
    const steps = buildDispatchTimelineState(
      baseQuote,
      {},
      null,
      { status: 'arrived' },
      { workflow_status: 'arrived_pickup', workflow_at: '2026-05-28T11:15:00Z' },
    )
    expect(steps.find((s) => s.id === 'arrived_pickup')?.state).toBe('current')
    expect(steps.find((s) => s.id === 'on_way')?.state).toBe('done')
  })

  it('highlights Loading after pickup Complete', () => {
    const steps = buildDispatchTimelineState(
      baseQuote,
      {},
      null,
      { status: 'in_progress' },
      { workflow_status: 'pickup_completed', workflow_at: '2026-05-28T12:00:00Z' },
    )
    expect(steps.find((s) => s.id === 'loading')?.state).toBe('current')
  })

  it('highlights In transit after dropoff Start', () => {
    const steps = buildDispatchTimelineState(
      { ...baseQuote, status: 'in_transit' },
      {},
      null,
      { status: 'in_progress' },
      { workflow_status: 'in_transit', workflow_at: '2026-05-28T13:00:00Z' },
    )
    expect(steps.find((s) => s.id === 'in_transit')?.state).toBe('current')
    expect(steps.find((s) => s.id === 'on_way')?.state).toBe('done')
  })

  it('highlights Arrived delivery after dropoff Arrived', () => {
    const steps = buildDispatchTimelineState(
      { ...baseQuote, status: 'arrived' },
      {},
      null,
      { status: 'arrived' },
      { workflow_status: 'arrived_delivery', workflow_at: '2026-05-28T14:00:00Z' },
    )
    expect(steps.find((s) => s.id === 'arrived_delivery')?.state).toBe('current')
  })

  it('marks Completed when booking is finished', () => {
    const steps = buildDispatchTimelineState(
      {
        ...baseQuote,
        status: 'completed',
        operational_status: 'Completed',
        completed_at: '2026-05-28T15:00:00Z',
      },
      {},
      null,
      { status: 'completed', updated_at: '2026-05-28T15:00:00Z' },
      { workflow_status: 'completed', workflow_at: '2026-05-28T15:00:00Z' },
    )
    expect(steps.find((s) => s.id === 'completed')?.state).toBe('current')
    expect(steps.every((s) => s.id === 'completed' || s.state === 'done')).toBe(true)
  })

  it('stamps each completed step from job_status_history', () => {
    const history = [
      { status: 'on_way', created_at: '2026-05-28T11:00:00Z' },
      { status: 'arrived_pickup', created_at: '2026-05-28T11:15:00Z' },
      { status: 'pickup_completed', created_at: '2026-05-28T12:00:00Z' },
      { status: 'in_transit', created_at: '2026-05-28T13:00:00Z' },
      { status: 'arrived_delivery', created_at: '2026-05-28T14:00:00Z' },
      { status: 'completed', created_at: '2026-05-28T15:00:00Z' },
    ]
    const stamps = buildStepTimestampsFromHistory(history, {
      acceptedAt: '2026-05-28T10:00:00Z',
    })
    expect(stamps.accepted).toBe('2026-05-28T10:00:00Z')
    expect(stamps.on_way).toBe('2026-05-28T11:00:00Z')
    expect(stamps.arrived_pickup).toBe('2026-05-28T11:15:00Z')
    expect(stamps.loading).toBe('2026-05-28T12:00:00Z')
    expect(stamps.in_transit).toBe('2026-05-28T13:00:00Z')
    expect(stamps.arrived_delivery).toBe('2026-05-28T14:00:00Z')
    expect(stamps.completed).toBe('2026-05-28T15:00:00Z')

    const steps = buildDispatchTimelineState(
      { ...baseQuote, status: 'completed', operational_status: 'Completed' },
      {},
      null,
      { status: 'completed' },
      { workflow_status: 'completed', workflow_at: '2026-05-28T15:00:00Z' },
      history,
    )
    expect(steps.find((s) => s.id === 'on_way')?.timestamp).toBeTruthy()
    expect(steps.find((s) => s.id === 'loading')?.timestamp).toBeTruthy()
    expect(steps.find((s) => s.id === 'arrived_delivery')?.timestamp).toBeTruthy()
  })

  it('maps generic arrived to pickup before in_transit', () => {
    expect(historyStatusToTimelineStepId('arrived', { deliveryPhase: false })).toBe('arrived_pickup')
    expect(historyStatusToTimelineStepId('arrived', { deliveryPhase: true })).toBe('arrived_delivery')
  })
})
