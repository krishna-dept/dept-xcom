// Deployment trigger comment
import { h, render, Component } from '@dropins/tools/preact.js';
// import htm from '../../scripts/htm.js';
import { readBlockConfig } from '../../scripts/aem.js';

const html = htm.bind(h);
// ---------- Static Category Config ----------
const CATEGORIES = [
  { id: 'all', label: 'All Deals' },
  { id: 'apparel-footwear', label: 'Apparel & Footwear' },
  { id: 'training-equipment', label: 'Training Equipment' },
  { id: 'smr-recovery', label: 'SMR & Recovery' },
  { id: 'branded-training', label: 'Branded Training' },
  { id: 'other', label: 'Other' },
];
const categoriesAuthorableImages = {};
// ---------- Utilities ----------
function getInitialFilter(categories) {
  try {
    const params = new URLSearchParams(window.location.search);
    const q = (params.get('filter') || '').toLowerCase();
    const exists = categories.find((c) => c.id === q);
    return exists ? exists.id : 'all';
  } catch {
    return 'all';
  }
}
function setFilterInUrl(filterId) {
  try {
    const url = new URL(window.location.href);
    if (filterId && filterId !== 'all') {
      url.searchParams.set('filter', filterId);
    } else {
      url.searchParams.delete('filter');
    }
    window.history.replaceState({}, '', url.toString());
  } catch {
    // noop
  }
}
// ---------- DealCard Component ----------
function DealCard({ deal }) {
  return html`
    <a class="deal-card" href="${deal.link}" aria-label="${deal.offerPercent}">
      <div class="deal-card__logo">
        <img src="${`${deal.logo}`}" alt="${deal.offerPercent} Logo" loading="lazy" />
      </div>
      <div class="deal-card__content">
        <div class="deal-card__offer">${deal.offerPercent}</div>
        <div class="deal-card__desc">
          <div dangerouslySetInnerHTML=${{ __html: deal.description }}></div>
        </div>
      </div>
    </a>
  `;
}
// ---------- Skeleton Loader ----------
function DealSkeleton({ i }) {
  return html`
    <div class="deal-card deal-card--skeleton" key=${`s-${i}`}>
      <div class="deal-card__logo skeleton-block"></div>
      <div class="deal-card__content">
        <div class="deal-card__offer skeleton-line" style="width: 40%"></div>
        <div class="deal-card__desc">
          <div class="skeleton-line" style="width: 100%"></div>
          <div class="skeleton-line" style="width: 85%"></div>
          <div class="skeleton-line" style="width: 70%"></div>
        </div>
      </div>
    </div>
  `;
}
// ---------- FilterBar Component ----------
function FilterBar({ categories, activeFilter, onFilterChange }) {
  return html`
    <div class="filter-container">
      ${categories.map((cat) => {
    const isActive = activeFilter === cat.id;
    const imgSrc = `${cat.icon}` || '';
    return html`
          <div
            class="filter-item ${isActive ? 'active' : ''}"
            onClick=${() => onFilterChange(cat.id)}
          >
            <img src="${imgSrc}" alt="" loading="lazy" />
            <p>${cat.label}</p>
          </div>
    `;
  })}
    </div>
  `;
}
// ---------- Main Component ----------
class DealsFilter extends Component {
  constructor(props) {
    super(props);
    const categories = props.categories || [];
    this.state = {
      isLoading: props.loading ?? false,
      categories,
      deals: props.deals || [],
      activeFilter: getInitialFilter(categories),
      blockTitle: props.blockTitle || 'Narrow Your Search Default Title',
    };
  }

  setActiveFilter = (filterId) => {
    this.setState({ activeFilter: filterId });
    setFilterInUrl(filterId);
  };

  getVisibleDeals() {
    const { deals, activeFilter } = this.state;
    if (activeFilter === 'all') return deals;
    return deals.filter((d) => d.categoryId === activeFilter);
  }

  renderGrid() {
    const { isLoading } = this.state;
    const items = this.getVisibleDeals();
    if (isLoading) {
      return html`
        <div class="deals-grid">
          ${Array.from({ length: 6 }).map((_, i) => html`<${DealSkeleton} i=${i} />`)}
        </div>
      `;
    }
    if (!items.length) {
      return html`
        <div class="deals-empty">
          <p>No deals match these filters. Clear or pick another filter.</p>
        </div>
      `;
    }
    return html`
      <div class="deals-grid">
        ${items.map((deal) => (deal.categoryId ? html`<${DealCard} deal=${deal} />` : null))}
      </div>
    `;
  }

  render() {
    const blockTitle = this.props.blockTitle || 'Narrow Your Search Default Title';
    return html`
      <section class="deals-filter block">
        <div class="deals-filter__header">
        <h2 class="deals-filter__title">${blockTitle}</h2>
          <${FilterBar}
            categories=${this.state.categories}
            activeFilter=${this.state.activeFilter}
            onFilterChange=${this.setActiveFilter}
          />
        </div>
        ${this.renderGrid()}
      </section>
    `;
  }
}

function parseNodeListToJSON(nodeList) {
  nodeList.forEach((item) => {
    // Get the text inside the <p> tag (which is the key)
    const key = item.querySelector('p').textContent.trim();

    // Get the src attribute of the <img> tag (which is the value)
    const imgSrc = item.querySelector('img').getAttribute('src');

    // Add the key-value pair to the result object
    categoriesAuthorableImages[key] = imgSrc;
  });
}

// Generate categories from the data
function generateCategories(data) {
  // Initialize an array to store unique categories
  const categories = [];

  // Add 'All Deals' as the first category
  const catIcon = categoriesAuthorableImages.all;
  categories.push({ id: 'all', label: 'All Deals', icon: catIcon });

  // Iterate through the data array to collect unique categoryId and label
  data.forEach((item) => {
    if (item.categoryId && !categories.some((category) => category.id === item.categoryId)) {
      const icon = categoriesAuthorableImages[item.categoryId];
      categories.push({ id: item.categoryId, label: item.label, icon });
    }
  });

  return categories;
}

// ---------- Block Decorator ----------
export default async function decorate(block) {
  readBlockConfig(block);
  const blockTitle = block.firstElementChild.textContent;
  parseNodeListToJSON([...block.children].slice(1));

  if (!window.location.origin.includes('author-')) {
    block.textContent = '';
  }

  try {
    const res = await fetch('/discountpartners/pro-discounts.json');
    if (!res.ok) throw new Error('Failed to fetch deals');
    const deals = await res.json();
    const categoriesFromDealsData = generateCategories(deals.data);
    render(html`<${DealsFilter} categories=${categoriesFromDealsData} deals=${deals.data} blockTitle=${blockTitle}/>`, block);
  } catch (e) {
    console.error('Could not load discount partners JSON:', e);
    render(html`<${DealsFilter} categories=${CATEGORIES} blockTitle=${blockTitle} />`, block);
  }
}
