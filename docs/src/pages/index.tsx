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
    image: 'img/screenshots/RQML-extension-UI-annotated.png',
    alt: 'Annotated overview of the RQML extension UI showing sidebar, document view, source editor, and agent panel',
  },
  {
    title: 'Structured Spec Browsing',
    description: (
      <>
        The sidebar tree view organizes your specification into sections —
        requirements, goals, scenarios, catalogs, and more. Select any item to
        see its details and navigate directly to the source definition.
      </>
    ),
    image: 'img/screenshots/RQML-overview-and-language-mode.png',
    alt: 'Sidebar tree view with RQML source code and syntax highlighting',
  },
  {
    title: 'Document and Matrix Views',
    description: (
      <>
        Render your spec as a browsable document with metadata, catalogs, and
        requirement statements. The requirements matrix gives you a birds-eye
        view of status, priority, and coverage across your entire specification.
      </>
    ),
    image: 'img/screenshots/RQML-doc-and-matrix-views.png',
    alt: 'Side-by-side document view and requirements matrix',
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
    image: 'img/screenshots/RQML-traceview-screenshot.png',
    alt: 'Trace graph visualization showing requirement dependencies and relationships',
  },
  {
    title: 'AI-Powered Agent',
    description: (
      <>
        The built-in RQML agent helps you author, analyze, and refine your
        requirements. Ask questions about your spec, request quality assessments,
        or let the agent plan implementation steps — with support for multiple
        LLM providers.
      </>
    ),
    image: 'img/screenshots/RQML-agent-screenshot.png',
    alt: 'RQML Agent panel showing spec status and slash commands',
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
