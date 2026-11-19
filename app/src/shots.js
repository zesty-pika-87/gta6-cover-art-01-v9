// Fixed scenes for screenshots: ?shot=cover shows the finished poster alone,
// ?shot=editor the full editor, ?shot=grid the Nine Panel layout, ?shot=story
// the Story Stack portrait. window.__shotReady is set once painted.
import { PRESETS } from './cover.js';

export function runShot(shot, query, state, images, draw, syncControls) {
  const presetName = query.get('preset');
  const preset = PRESETS.find(p => p.name === presetName) || PRESETS[0];
  const layout = query.get('layout');
  const grade = query.get('grade');
  Object.assign(state, {
    layout: layout || preset.layout,
    grade: grade || preset.grade,
    title: query.get('title') || preset.title,
    subtitle: query.get('subtitle') || preset.subtitle,
    strip: query.get('strip') || preset.strip,
    photos: [...preset.photos],
    halftone: true, grain: true, vignette: true, titlePos: 'auto',
  });
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const cv = document.getElementById('cover');
    cv.width = 1080; cv.height = 1080;
  } else if (shot === 'grid') {
    document.body.classList.add('shot-grid');
    state.layout = 'nine'; state.grade = 'neon';
    state.title = 'NEON COAST'; state.subtitle = 'Six nights in paradise';
    const cv = document.getElementById('cover');
    cv.width = 1080; cv.height = 1080;
  } else if (shot === 'story') {
    document.body.classList.add('shot-story');
    state.layout = 'story'; state.grade = 'palm';
    state.title = 'LEONIDA HEAT'; state.subtitle = 'Boardwalk nights';
    const cv = document.getElementById('cover');
    cv.width = 1080; cv.height = 1920;
  }
  syncControls();
  draw();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
