import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api.js';
import { Button, Input, Modal, Select, Textarea, cx } from './ui.jsx';

const TOPIC_IDEAS = ['The future of AI in education', 'How remote teams can stay connected', 'A beginner’s guide to personal finance', 'Why sleep matters for productivity'];
const AUDIENCES = ['General readers', 'Beginners', 'Software developers', 'Startup founders', 'Students', 'Busy managers'];

const chip = 'rounded border px-2.5 py-1 text-xs transition-colors';

export function NewBlogModal({ open, onClose, onCreated }) {
  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState('General readers');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(0.5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (topic.trim().length < 3) return setError('Give your blog a topic (at least 3 characters).');
    setBusy(true);
    try {
      const body = { topic: topic.trim(), audience: audience.trim() || undefined };
      if (showAdvanced) {
        if (provider) body.provider = provider;
        if (model.trim()) body.model = model.trim();
        body.temperature = Number(temperature);
      }
      const view = await api.createProject(body);
      setTopic('');
      onCreated(view);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New blog" subtitle="Three agents research, write and edit it. You approve every step.">
      <form onSubmit={submit} className="space-y-6">
        <div>
          <Textarea label="What should the blog be about?" rows={3} autoFocus value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. The future of AI in education" maxLength={200} />
          <div className="mt-2.5 flex flex-wrap gap-2">
            {TOPIC_IDEAS.map((t) => (
              <button key={t} type="button" onClick={() => setTopic(t)} className={cx(chip, 'border-line-strong text-muted hover:bg-sunken hover:text-ink')}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Input label="Who is it for?" value={audience} onChange={(e) => setAudience(e.target.value)} maxLength={200} />
          <div className="mt-2.5 flex flex-wrap gap-2">
            {AUDIENCES.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAudience(a)}
                className={cx(chip, audience === a ? 'border-ink bg-ink text-paper' : 'border-line-strong text-muted hover:bg-sunken hover:text-ink')}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div>
          <button type="button" onClick={() => setShowAdvanced((v) => !v)} aria-expanded={showAdvanced} className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
            <ChevronDown className={cx('size-4 transition-transform', showAdvanced && 'rotate-180')} strokeWidth={1.75} /> Model settings
          </button>
          {showAdvanced && (
            <div className="mt-3 grid gap-4 rounded-md border border-line bg-sunken p-4 sm:grid-cols-2">
              <Select label="Provider" value={provider} onChange={(e) => setProvider(e.target.value)}>
                <option value="">Server default</option>
                <option value="groq">Groq</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </Select>
              <Input label="Model (optional)" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Provider default" />
              <div className="sm:col-span-2">
                <label htmlFor="temp" className="mb-1.5 flex justify-between text-sm font-medium">
                  <span>Creativity</span>
                  <span className="tabular-nums text-muted">{Number(temperature).toFixed(1)}</span>
                </label>
                <input id="temp" type="range" min="0" max="1.2" step="0.1" value={temperature} onChange={(e) => setTemperature(e.target.value)} className="w-full accent-[var(--accent)]" />
                <div className="flex justify-between text-xs text-faint">
                  <span>Precise</span>
                  <span>Creative</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="accent" loading={busy}>
            Start the agents
          </Button>
        </div>
      </form>
    </Modal>
  );
}
