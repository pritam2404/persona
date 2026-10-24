import { planTomorrow } from '../lib/predict.js';
import { durationMin, fmtDuration } from '../lib/time.js';

const CONF = { low: 'Kam bharosa', medium: 'Theek bharosa', high: 'Achha bharosa' };

export default function PlanView({ tasks, day }) {
  const plan = planTomorrow(tasks, day);

  return (
    <section aria-labelledby="plan-h">
      <h2 id="plan-h">Kal ka plan ({plan.date})</h2>
      <p className="muted">
        <span className={`badge conf-${plan.confidence}`}>{CONF[plan.confidence]}</span>{' '}
        {plan.dataDays} din ke data pe based. Ye suggestion hai, order nahi.
      </p>

      {plan.notes.map((n) => <p key={n} className="card note-card">{n}</p>)}

      {plan.items.length > 0 && (
        <ol className="timeline">
          {plan.items.map((i) => (
            <li key={i.start + i.title} className={i.focus ? 'slot focus' : 'slot'}>
              <span className="slot-time">{i.start}<br /><span className="muted">{i.end}</span></span>
              <div>
                <strong>{i.title}</strong>
                <span className="muted"> · {i.category} · {fmtDuration(durationMin(i.start, i.end))}</span>
                <p className="why">{i.reason}</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      <details className="card">
        <summary>Ye plan kaise banta hai?</summary>
        <ol className="how">
          <li>Aaj jo skip ya adhoora raha, wo kal pehle.</li>
          <li>Jo kaam pichhle 14 din mein 3+ din hua, wo routine hai, kal bhi.</li>
          <li>Time = us kaam ka asli median time, estimate nahi.</li>
          <li>Focus wale kaam (Deep work, Study, Side project) tumhare high-energy ghante (avg 3.5+) mein.</li>
          <li>Baaki kaam bachi khali jagah mein, bina overlap.</li>
        </ol>
        <p className="hint">ML abhi jaan-boojh ke nahi hai. 30+ din ke data ke baad uska matlab banta hai.</p>
      </details>
    </section>
  );
}
