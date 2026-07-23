import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'RQML for VS Code',
  tagline: 'Keep requirements and code in sync, in version control.',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://rqml.dev',
  baseUrl: '/vscode/',

  organizationName: 'rqml-org',
  projectName: 'rqml-vscode',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl:
            'https://github.com/rqml-org/rqml-vscode/tree/main/docs/',
        },
        // No blog. The only posts this site ever had were the Docusaurus
        // starter's sample entries, which were live on rqml.dev.
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/social-card.jpg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'RQML for VS Code',
      logo: {
        alt: 'RQML Logo',
        src: 'img/RQML_logo_transparent.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://github.com/rqml-org/rqml-vscode',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/intro',
            },
          ],
        },
        {
          title: 'Resources',
          items: [
            {
              label: 'RQML Standard',
              href: 'https://rqml.org',
            },
            {
              label: 'VS Code Marketplace',
              href: 'https://marketplace.visualstudio.com/items?itemName=rqml.rqml-vscode',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/rqml-org/rqml-vscode',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Stakkar. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['markup'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
