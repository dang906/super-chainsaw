/* ── State ───────────────────────────────────────────────────────────────── */
let familyCode  = sessionStorage.getItem('familyCode') || null;
let currentTab  = 'public';

/* ── DOM refs ────────────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

const heroName        = $('hero-name');
const heroDates       = $('hero-dates');
const heroBio         = $('hero-bio');
const loadingEl       = $('loading');
const emptyState      = $('empty-state');
const postsContainer  = $('posts-container');

const tabPublic       = $('tab-public');
const tabFamily       = $('tab-family');

const btnShare        = $('btn-share');
const btnShareEmpty   = $('btn-share-empty');

const modalShare      = $('modal-share');
const modalFamily     = $('modal-family');

const formShare       = $('form-share');
const inputAuthor     = $('input-author');
const inputContent    = $('input-content');
const inputMedia      = $('input-media');
const charCount       = $('char-count');
const fileUploadArea  = $('file-upload-area');
const uploadPlaceholder = $('upload-placeholder');
const uploadPreview   = $('upload-preview');

const familyCodeInput = $('family-code-input');
const btnVerifyFamily = $('btn-verify-family');
const toast           = $('toast');

/* ── Init ────────────────────────────────────────────────────────────────── */
async function init() {
  await Promise.all([loadConfig(), loadPosts()]);
}

async function loadConfig() {
  try {
    const res    = await fetch('/api/config');
    const config = await res.json();

    if (config.personName) {
      heroName.textContent  = config.personName;
      document.title        = `In Memory of ${config.personName}`;
    }
    if (config.personDates) heroDates.textContent = config.personDates;
    if (config.personBio)   heroBio.textContent   = config.personBio;
  } catch {
    // Non-fatal — defaults are already in the HTML
  }
}

async function loadPosts() {
  loadingEl.style.display = 'flex';
  emptyState.style.display = 'none';
  postsContainer.innerHTML = '';

  try {
    const headers = {};
    if (currentTab === 'family' && familyCode) {
      headers['x-family-code'] = familyCode;
    }

    const res       = await fetch('/api/posts', { headers });
    const { posts } = await res.json();

    loadingEl.style.display = 'none';

    if (posts.length === 0) {
      emptyState.style.display = 'block';
    } else {
      const fragment = document.createDocumentFragment();
      posts.forEach((post, i) => {
        const card = renderPost(post);
        card.style.animationDelay = `${i * 40}ms`;
        fragment.appendChild(card);
      });
      postsContainer.appendChild(fragment);
    }
  } catch {
    loadingEl.style.display = 'none';
    postsContainer.innerHTML =
      `<p style="text-align:center;color:var(--text-muted);padding:48px 0">
        Could not load memories. Please refresh the page.
      </p>`;
  }
}

/* ── Render post card ────────────────────────────────────────────────────── */
function renderPost(post) {
  const card = document.createElement('article');
  card.className = `post-card${post.visibility === 'family' ? ' family-post' : ''}`;

  let mediaHtml = '';
  if (post.media_filename) {
    const src = `/uploads/${esc(post.media_filename)}`;
    mediaHtml = post.media_type === 'video'
      ? `<video class="post-media-video" src="${src}" controls preload="none"
           aria-label="Video shared by ${esc(post.author_name)}"></video>`
      : `<img class="post-media" src="${src}"
           alt="Photo shared by ${esc(post.author_name)}" loading="lazy"
           onerror="this.style.display='none'">`;
  }

  const familyBadge = post.visibility === 'family'
    ? `<span class="badge badge-family" aria-label="Family only">🏡 Family</span>` : '';

  card.innerHTML = `
    ${mediaHtml}
    <div class="post-body">
      <div class="post-header">
        <div class="post-author-row">
          <div class="post-avatar" aria-hidden="true">${esc(initials(post.author_name))}</div>
          <div>
            <div class="post-author-name">${esc(post.author_name)}</div>
            <div class="post-date">${formatDate(post.created_at)}</div>
          </div>
        </div>
        <div class="post-badges">${familyBadge}</div>
      </div>
      <div class="post-content">${esc(post.content)}</div>
    </div>`;

  return card;
}

function initials(name) {
  const parts = String(name).trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : String(name).slice(0, 2).toUpperCase();
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(raw) {
  try {
    const d = new Date(raw.includes('T') ? raw : raw + 'Z');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return raw; }
}

/* ── Tab switching ───────────────────────────────────────────────────────── */
tabPublic.addEventListener('click', () => {
  if (currentTab === 'public') return;
  currentTab = 'public';
  tabPublic.classList.add('active');
  tabPublic.setAttribute('aria-selected', 'true');
  tabFamily.classList.remove('active');
  tabFamily.setAttribute('aria-selected', 'false');
  loadPosts();
});

tabFamily.addEventListener('click', () => {
  if (currentTab === 'family') return;
  if (!familyCode) {
    showModal('modal-family');
    return;
  }
  switchToFamily();
});

function switchToFamily() {
  currentTab = 'family';
  tabFamily.classList.add('active');
  tabFamily.setAttribute('aria-selected', 'true');
  tabPublic.classList.remove('active');
  tabPublic.setAttribute('aria-selected', 'false');
  loadPosts();
}

/* ── Share modal ─────────────────────────────────────────────────────────── */
btnShare.addEventListener('click',      () => showModal('modal-share'));
btnShareEmpty?.addEventListener('click', () => showModal('modal-share'));
$('close-share').addEventListener('click',    () => hideModal('modal-share'));
$('btn-cancel-share').addEventListener('click', () => hideModal('modal-share'));

/* ── Family auth modal ───────────────────────────────────────────────────── */
$('close-family').addEventListener('click', () => hideModal('modal-family'));

familyCodeInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') btnVerifyFamily.click();
});

btnVerifyFamily.addEventListener('click', async () => {
  const code = familyCodeInput.value.trim();
  if (!code) return;

  const errorEl = $('family-auth-error');
  errorEl.textContent = '';
  btnVerifyFamily.disabled = true;
  btnVerifyFamily.textContent = 'Checking…';

  try {
    const res  = await fetch('/api/verify-family', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ code }),
    });
    const data = await res.json();

    if (data.success) {
      familyCode = code;
      sessionStorage.setItem('familyCode', code);
      hideModal('modal-family');
      familyCodeInput.value = '';
      switchToFamily();
      showToast('Family access granted');
    } else {
      errorEl.textContent = data.error || 'Incorrect code. Please try again.';
    }
  } catch {
    errorEl.textContent = 'Connection error. Please try again.';
  } finally {
    btnVerifyFamily.disabled = false;
    btnVerifyFamily.textContent = 'Enter';
  }
});

/* ── Modal helpers ───────────────────────────────────────────────────────── */
function showModal(id) {
  $(id).classList.add('active');
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    const el = $(id).querySelector('input:not([type=radio]):not([type=file]), textarea');
    el?.focus();
  }, 60);
}

function hideModal(id) {
  $(id).classList.remove('active');
  document.body.style.overflow = '';
}

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) hideModal(overlay.id);
  });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(m => hideModal(m.id));
  }
});

/* ── Character counter ───────────────────────────────────────────────────── */
inputContent.addEventListener('input', () => {
  charCount.textContent = inputContent.value.length.toLocaleString();
});

/* ── File upload ─────────────────────────────────────────────────────────── */
let selectedFile = null;

inputMedia.addEventListener('change', () => {
  const file = inputMedia.files[0];
  if (file) handleFileSelect(file);
});

fileUploadArea.addEventListener('dragover', e => {
  e.preventDefault();
  fileUploadArea.classList.add('drag-over');
});

fileUploadArea.addEventListener('dragleave', () => {
  fileUploadArea.classList.remove('drag-over');
});

fileUploadArea.addEventListener('drop', e => {
  e.preventDefault();
  fileUploadArea.classList.remove('drag-over');
  const file = e.dataTransfer?.files[0];
  if (!file) return;
  if (!/^(image|video)\//.test(file.type)) {
    $('error-media').textContent = 'Only images and videos are allowed.';
    return;
  }
  try {
    const dt = new DataTransfer();
    dt.items.add(file);
    inputMedia.files = dt.files;
  } catch { /* DataTransfer not supported in all browsers — fall through */ }
  handleFileSelect(file);
});

function handleFileSelect(file) {
  selectedFile = file;
  $('error-media').textContent = '';
  uploadPlaceholder.style.display = 'none';
  uploadPreview.style.display = 'block';

  const nameTrunc = file.name.length > 40 ? file.name.slice(0, 37) + '…' : file.name;
  const sizeStr   = file.size > 1024 * 1024
    ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.round(file.size / 1024)} KB`;

  const metaHtml = `
    <div class="upload-meta">
      <span title="${esc(file.name)}">${esc(nameTrunc)} · ${sizeStr}</span>
      <button type="button" class="btn-remove-file" id="btn-remove-file">Remove</button>
    </div>`;

  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = e => {
      uploadPreview.innerHTML =
        `<img src="${e.target.result}" alt="Selected image preview">${metaHtml}`;
      $('btn-remove-file').addEventListener('click', clearUpload);
    };
    reader.readAsDataURL(file);
  } else {
    const url = URL.createObjectURL(file);
    uploadPreview.innerHTML =
      `<video src="${url}" controls preload="metadata"
         aria-label="Selected video preview"></video>${metaHtml}`;
    $('btn-remove-file').addEventListener('click', clearUpload);
  }
}

function clearUpload() {
  selectedFile = null;
  inputMedia.value = '';
  uploadPlaceholder.style.display = 'flex';
  uploadPreview.style.display = 'none';
  uploadPreview.innerHTML = '';
}

/* ── Form submission ─────────────────────────────────────────────────────── */
formShare.addEventListener('submit', async e => {
  e.preventDefault();

  const authorVal  = inputAuthor.value.trim();
  const contentVal = inputContent.value.trim();
  const visibility = formShare.querySelector('[name="visibility"]:checked')?.value || 'public';

  // Clear previous errors
  $('error-author').textContent  = '';
  $('error-content').textContent = '';
  $('error-global').style.display = 'none';
  inputAuthor.classList.remove('error');
  inputContent.classList.remove('error');

  let valid = true;

  if (!authorVal) {
    $('error-author').textContent = 'Please enter your name.';
    inputAuthor.classList.add('error');
    inputAuthor.focus();
    valid = false;
  }

  if (!contentVal) {
    $('error-content').textContent = 'Please share a memory.';
    inputContent.classList.add('error');
    if (valid) inputContent.focus();
    valid = false;
  }

  if (!valid) return;

  // Show loading state
  const submitBtn  = $('btn-submit');
  const btnLabel   = submitBtn.querySelector('.btn-label');
  const btnSpinner = submitBtn.querySelector('.btn-spinner');
  submitBtn.disabled        = true;
  btnLabel.textContent      = 'Sharing…';
  btnSpinner.style.display  = 'inline-block';

  try {
    const formData = new FormData();
    formData.append('author_name', authorVal);
    formData.append('content',     contentVal);
    formData.append('visibility',  visibility);
    if (inputMedia.files[0]) formData.append('media', inputMedia.files[0]);

    const res  = await fetch('/api/posts', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Failed to share. Please try again.');

    hideModal('modal-share');
    resetForm();
    showToast('Your memory has been shared');

    // If the post is family-only and we're in public view, stay in public view
    // so the contributor can see their post if they're family-authenticated
    if (visibility === 'family' && currentTab !== 'family') {
      showToast('Memory saved — switch to Family Only to view it');
    }

    await loadPosts();
    $('controls-bar').scrollIntoView({ behavior: 'smooth' });

  } catch (err) {
    const globalErr = $('error-global');
    globalErr.textContent  = err.message;
    globalErr.style.display = 'block';
  } finally {
    submitBtn.disabled       = false;
    btnLabel.textContent     = 'Share Memory';
    btnSpinner.style.display = 'none';
  }
});

function resetForm() {
  formShare.reset();
  inputAuthor.classList.remove('error');
  inputContent.classList.remove('error');
  charCount.textContent = '0';
  clearUpload();
  $('error-author').textContent  = '';
  $('error-content').textContent = '';
  $('error-global').style.display = 'none';
}

/* ── Toast ───────────────────────────────────────────────────────────────── */
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3500);
}

/* ── Start ───────────────────────────────────────────────────────────────── */
init();
