// REQ-MAT-002, REQ-MAT-009: Theme-aware status pills used in the matrix.
import React from 'react';
import type { Impact, SyncStatus, VerificationStatus } from '../types';

type Tone = 'ok' | 'warn' | 'error' | 'info' | 'muted';

interface PillProps {
  tone: Tone;
  children: React.ReactNode;
  title?: string;
}

export const Pill: React.FC<PillProps> = ({ tone, children, title }) => (
  <span className={`pill tone-${tone}`} title={title}>{children}</span>
);

export const VerificationPill: React.FC<{ status: VerificationStatus }> = ({ status }) => {
  const tone: Tone =
    status === 'Verified' ? 'ok' :
    status === 'Partially verified' ? 'warn' :
    status === 'Unverified' ? 'error' :
    'muted';
  return <Pill tone={tone}>{status}</Pill>;
};

export const SyncPill: React.FC<{ status: SyncStatus }> = ({ status }) => {
  const tone: Tone =
    status === 'Implemented' ? 'ok' :
    status === 'Partially Implemented' ? 'warn' :
    status === 'Not Started' ? 'muted' :
    status === 'Deprecated' ? 'muted' :
    'error'; // Broken Trace
  return <Pill tone={tone}>{status}</Pill>;
};

export const ImpactPill: React.FC<{ impact: Impact }> = ({ impact }) => {
  const tone: Tone =
    impact === 'Critical' ? 'error' :
    impact === 'High' ? 'warn' :
    impact === 'Medium' ? 'info' :
    'muted';
  return <Pill tone={tone}>{impact}</Pill>;
};

export const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const tone: Tone =
    status === 'approved' ? 'ok' :
    status === 'review' ? 'info' :
    status === 'draft' ? 'muted' :
    status === 'deprecated' ? 'muted' :
    'muted';
  return <Pill tone={tone}>{status}</Pill>;
};
