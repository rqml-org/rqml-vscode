import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  icon: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Requirements as Code',
    icon: '\u{1F4DD}',
    description: (
      <>
        Author structured requirements in RQML — an XML-based language with
        full XSD validation, traceability, and version control built in.
      </>
    ),
  },
  {
    title: 'AI-Powered Agent',
    icon: '\u{1F916}',
    description: (
      <>
        Use the integrated AI agent to analyze, refine, and generate
        requirements directly within VS Code. Supports multiple LLM providers.
      </>
    ),
  },
  {
    title: 'Full Traceability',
    icon: '\u{1F517}',
    description: (
      <>
        Trace edges link requirements, scenarios, test cases, and interfaces.
        Navigate your specification through an interactive tree view.
      </>
    ),
  },
];

function Feature({title, icon, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <span className={styles.featureIcon} role="img">{icon}</span>
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
