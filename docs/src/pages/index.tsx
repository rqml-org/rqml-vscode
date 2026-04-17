import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero', styles.heroBanner)}>
      <div className="container">
        <img
          src="img/RQML_logo_transparent.png"
          alt="RQML Logo"
          className={styles.heroLogo}
        />
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--primary button--lg"
            to="/docs/intro">
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}

type ShowcaseItem = {
  title: string;
  description: ReactNode;
  image: string;
  alt: string;
};

const showcaseItems: ShowcaseItem[] = [
  {
    title: 'Everything in One View',
    description: (
      <>
        Browse your spec through an interactive sidebar, view rendered documents,
        edit native RQML source, and interact with the AI agent — all within a
        single VS Code window.
      </>
    ),
    image: 'img/screenshots/RQML-UI-overview.png',
    alt: 'Overview of the RQML extension UI showing sidebar, document view, source editor, and agent panel',
  },
  {
    title: 'Requirements Matrix',
    description: (
      <>
        The requirements matrix gives you a birds-eye view of status, priority,
        and coverage across your entire specification — quickly spot gaps,
        untested requirements, and areas that need attention.
      </>
    ),
    image: 'img/screenshots/RQML-matrix.png',
    alt: 'Requirements matrix view',
  },
  {
    title: 'Visual Trace Graph',
    description: (
      <>
        Explore traceability edges between requirements, scenarios, test cases,
        and interfaces in a full interactive graph. Understand dependencies and
        coverage at a glance.
      </>
    ),
    image: 'img/screenshots/RQML-trace-map.png',
    alt: 'Trace graph visualization showing requirement dependencies and relationships',
  },
  {
    title: 'Architectural Decisions',
    description: (
      <>
        The agent guides you through recording architectural decisions as ADRs,
        classifying each choice and tracing it back to requirements. Your design
        rationale lives alongside the spec, not in scattered documents.
      </>
    ),
    image: 'img/screenshots/RQML-agent-ADRs.png',
    alt: 'RQML Agent creating an architecture decision record',
  },
  {
    title: 'AI-Powered Implementation',
    description: (
      <>
        The built-in agent plans, proposes, and implements code from your spec —
        with approval gates for every file change. Support for multiple LLM
        providers including Anthropic, OpenAI, Azure, and Google.
      </>
    ),
    image: 'img/screenshots/RQML-agent-plan-implementation.png',
    alt: 'RQML Agent panel showing plan execution and implementation',
  },
];

function ShowcaseSection({item, reversed}: {item: ShowcaseItem; reversed: boolean}) {
  return (
    <section className={clsx(styles.showcaseSection, reversed && styles.showcaseReversed)}>
      <div className={clsx('container', styles.showcaseContainer)}>
        <div className={styles.showcaseText}>
          <Heading as="h2">{item.title}</Heading>
          <p>{item.description}</p>
        </div>
        <div className={styles.showcaseImage}>
          <img src={item.image} alt={item.alt} loading="lazy" />
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="RQML for VS Code — requirements-driven development with AI assistance">
      <HomepageHeader />
      <main>
        {showcaseItems.map((item, idx) => (
          <ShowcaseSection key={idx} item={item} reversed={idx % 2 === 1} />
        ))}
      </main>
    </Layout>
  );
}
