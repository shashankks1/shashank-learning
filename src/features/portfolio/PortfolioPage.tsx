import { curriculum } from '../../curriculum';
import { PortfolioStatusPill } from '../../components/domain';
import { Icon } from '../../components/Icon';
import { PageHeader, Principle } from '../../components/ui';
import { useStore } from '../../store/store';

export default function PortfolioPage() {
  const { data } = useStore();
  const published = data.portfolio.filter(slot => slot.status === 'published').length;
  return (
    <>
      <PageHeader
        eyebrow={`Portfolio · ${published} of 5 published`}
        title="Five proofs of increasing capability"
        lede="Not five arbitrary projects: a ladder. Each rung shows something the previous one couldn’t. A slot is only ‘published’ when someone outside this app can open it."
      />
      <ol className="ladder">
        {curriculum.portfolioSlots.map(definition => {
          const slot = data.portfolio.find(item => item.slot === definition.slot)!;
          return (
            <li key={definition.slot} className={`ladder__rung status-${slot.status}`}>
              <a href={`#/portfolio/${definition.slot}`} className="ladder__link">
                <span className="ladder__n mono">{String(definition.slot).padStart(2, '0')}</span>
                <span className="ladder__body">
                  <span className="mono-label">{definition.theme}</span>
                  <span className="ladder__title">{slot.project || 'Not chosen yet'}</span>
                  <span className="ladder__intent">{slot.capability || definition.intent}</span>
                </span>
                <span className="ladder__meta">
                  <PortfolioStatusPill status={slot.status} />
                  <span className="ladder__links">
                    {slot.github && <Icon name="github" size={15} />}
                    {slot.live && <Icon name="globe" size={15} />}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ol>
      <Principle>Evidence &gt; confidence. Ship &gt; polish endlessly.</Principle>
    </>
  );
}
