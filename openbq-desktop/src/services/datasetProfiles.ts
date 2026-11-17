import YAML from 'yaml';
import { callLLM } from '../llms.tsx';
import { getAISettings } from '../components/Settings.tsx';
import { fieldConfig as fallbackFieldConfig } from '../openbq_defs.tsx';

export type FieldProfile = {
  label: string;
  priority: number;
  group: string;
  is_score: boolean;
  is_scalar: boolean;
  is_index: boolean;
  exclude: boolean;
  is_image: boolean;
  description: string;
  thresholds: {
    very_good: number;
    good: number;
    poor: number;
    very_poor: number;
  };
};

export type DatasetProfile = {
  profile_id: string;
  fields: Record<string, FieldProfile>;
  settings?: {
    dbscanMinPts: number;
    hdbscanMinSamples: number;
    useDbscan: boolean;
    dbscanEpsKNN: number;
    umapNNeighbors: number;
    umapMinDist: number;
    clusterMethod: 'umap' | 'pca' | 'supercluster' | 'jsdbscan';
    pcaMinPts: number;
    pcaMaxComponents: number;
    pcaSweepIterations: number;
    superclusterMinPoints: number;
    superclusterRadius: number;
    superclusterMinZoom: number;
    superclusterMaxZoom: number;
    excludeNonScalar: boolean;
    oneHotEncode: boolean;
    excludeLowVariance: boolean;
    hideNonScalar: boolean;
    hidePerfect: boolean;
  };
};

type ProfileLoadResult = {
  profile: DatasetProfile;
  created: boolean;
  source: 'default' | 'user';
  path?: string;
};

const DEFAULT_PROFILE_DIRS = [
  'public/dataset-profiles/default',
  'dist/dataset-profiles/default'
];
const USER_PROFILE_DIR = 'dataset-profiles';
const DEFAULT_SETTINGS: NonNullable<DatasetProfile['settings']> = {
  dbscanMinPts: 5,
  hdbscanMinSamples: 5,
  useDbscan: false,
  dbscanEpsKNN: 0.8,
  umapNNeighbors: 0,
  umapMinDist: 0.3,
  clusterMethod: 'jsdbscan',
  pcaMinPts: 5,
  pcaMaxComponents: 10,
  pcaSweepIterations: 5,
  superclusterMinPoints: 2,
  superclusterRadius: 40,
  superclusterMinZoom: 0,
  superclusterMaxZoom: 16,
  excludeNonScalar: false,
  oneHotEncode: false,
  excludeLowVariance: false,
  hideNonScalar: false,
  hidePerfect: false
};

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16);
}

export function computeProfileIdFromFields(fields: string[]): string {
  const sorted = [...new Set(fields)].sort();
  const payload = sorted.join('\n');
  return fnv1a(payload);
}

function extractFieldNames(rows: any[]): string[] {
  const keys = new Set<string>();
  rows.forEach(row => {
    if (!row || typeof row !== 'object') return;
    Object.keys(row).forEach(k => keys.add(k));
  });
  return Array.from(keys);
}

async function getAppPath(): Promise<string | null> {
  return window.electron?.getPath ? await window.electron.getPath('appPath') : null;
}

async function getUserDataPath(): Promise<string | null> {
  return window.electron?.getPath ? await window.electron.getPath('userData') : null;
}

async function listYamlFiles(dirPath: string): Promise<string[]> {
  const res = await window.electron?.fs?.readDir?.(dirPath);
  if (!res?.success) return [];
  return res.entries
    .filter(entry => entry.isFile && /\.(ya?ml)$/i.test(entry.name))
    .map(entry => `${dirPath}/${entry.name}`);
}

async function readYamlFile(path: string): Promise<DatasetProfile | null> {
  const res = await window.electron?.fs?.readFile?.(path);
  if (!res?.success) return null;
  try {
    const data = YAML.parse(res.content);
    if (!data?.profile_id || !data?.fields) return null;
    return data as DatasetProfile;
  } catch (err) {
    console.error('Failed to parse YAML profile', path, err);
    return null;
  }
}

async function writeYamlFile(path: string, profile: DatasetProfile): Promise<void> {
  const content = YAML.stringify(profile);
  if (window.electron?.fs?.writeFileAbsolute) {
    await window.electron.fs.writeFileAbsolute(path, content);
  } else {
    await window.electron?.fs?.writeFile?.(path, content);
  }
}

async function loadProfiles(): Promise<Map<string, DatasetProfile>> {
  const profiles = new Map<string, DatasetProfile>();

  const appPath = await getAppPath();
  if (appPath) {
    for (const dir of DEFAULT_PROFILE_DIRS) {
      const defaultDir = `${appPath}/${dir}`;
      const files = await listYamlFiles(defaultDir);
      for (const file of files) {
        const profile = await readYamlFile(file);
        if (profile?.profile_id) profiles.set(profile.profile_id, profile);
      }
    }
  }

  const userData = await getUserDataPath();
  if (userData) {
    const userDir = `${userData}/${USER_PROFILE_DIR}`;
    await window.electron?.fs?.ensureDir?.(userDir);
    const files = await listYamlFiles(userDir);
    for (const file of files) {
      const profile = await readYamlFile(file);
      if (profile?.profile_id) profiles.set(profile.profile_id, profile);
    }
  }

  return profiles;
}

function toFieldProfile(entry: any, key: string): FieldProfile {
  const scalarByName = /scalar/i.test(key);
  const thresholds = entry?.thresholds ?? {
    very_good: 90,
    good: 76,
    poor: 50,
    very_poor: 25
  };
  return {
    label: entry?.label ?? key,
    priority: typeof entry?.priority === 'number' ? entry.priority : 0,
    group: entry?.group ?? 'General',
    is_score: !!entry?.is_score,
    is_scalar: entry?.is_scalar ?? scalarByName ?? false,
    is_index: !!entry?.is_index,
    exclude: !!entry?.exclude,
    is_image: !!entry?.is_image,
    description: entry?.description ?? '',
    thresholds
  };
}

function fallbackProfile(profileId: string): DatasetProfile {
  const fields: Record<string, FieldProfile> = {};
  Object.entries(fallbackFieldConfig).forEach(([key, value]) => {
    fields[key] = toFieldProfile(value, key);
  });
  return {
    profile_id: profileId,
    fields,
    settings: DEFAULT_SETTINGS
  };
}

async function inferFieldProfile(
  fieldName: string,
  samples: any[],
  groupOptions: string[]
): Promise<FieldProfile> {
  const groupsText = groupOptions.length ? groupOptions.join(', ') : 'General';
  const prompt = `
You are labeling a dataset field for a biometric quality dataset.
Field name: ${fieldName}
Sample values (first 3 rows):
${samples.map((v, i) => `Row ${i + 1}: ${String(v)}`).join('\n')}

Return ONLY valid JSON in this exact schema:
{
  "label": "String",
  "priority": 0,
  "group": "String (one of: ${groupsText})",
  "is_score": false,
  "is_scalar": false,
  "is_index": false,
  "exclude": false,
  "is_image": false,
  "description": "String",
  "thresholds": {
    "very_good": 90,
    "good": 76,
    "poor": 50,
    "very_poor": 25
  }
}

Rules:
- label should be short and human-friendly
- priority is a number (higher = more important)
- group must be one of the provided group options
- is_score = true for quality scores/percentages
- is_scalar = true if this is a 0-100 scalar score (usually percent-like)
- is_index = true if this looks like an index/id column
- exclude = true for IDs/metadata/noise not useful for analysis
- is_image = true if values are image paths or image-like identifiers
 - description is a concise one-sentence field description
 - thresholds define score bands for 0-100 scores
`;

  const raw = await callLLM(prompt, getAISettings());
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return {
      label: fieldName,
      priority: 0,
      group: 'General',
      is_score: false,
      exclude: false,
      is_image: false
    };
  }
  try {
    const parsed = JSON.parse(match[0]);
    return {
      label: parsed.label ?? fieldName,
      priority: Number.isFinite(parsed.priority) ? parsed.priority : 0,
      group: parsed.group ?? (groupOptions[0] ?? 'General'),
      is_score: !!parsed.is_score,
      is_scalar: !!parsed.is_scalar,
      is_index: !!parsed.is_index,
      exclude: !!parsed.exclude,
      is_image: !!parsed.is_image,
      description: parsed.description ?? '',
      thresholds: parsed.thresholds ?? {
        very_good: 90,
        good: 76,
        poor: 50,
        very_poor: 25
      }
    };
  } catch (err) {
    console.error('Failed to parse field profile JSON', fieldName, err);
    return {
      label: fieldName,
      priority: 0,
      group: groupOptions[0] ?? 'General',
      is_score: false,
      is_scalar: /scalar/i.test(fieldName),
      is_index: false,
      exclude: false,
      is_image: false,
      description: '',
      thresholds: {
        very_good: 90,
        good: 76,
        poor: 50,
        very_poor: 25
      }
    };
  }
}

async function inferGroupOptions(rows: any[], fieldNames: string[]): Promise<string[]> {
  const sampleLines = fieldNames.slice(0, 25).map(name => {
    const values = rows.slice(0, 3).map(r => String(r?.[name]));
    return `${name}: ${values.join(' | ')}`;
  });
  const prompt = `
You are designing group names for dataset fields.
Provide 5-6 group names that cover the following field samples:
${sampleLines.join('\n')}

Return ONLY valid JSON:
{ "groups": ["Group A", "Group B", "Group C", "Group D", "Group E", "Group F"] }
`;
  try {
    const raw = await callLLM(prompt, getAISettings());
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    if (Array.isArray(parsed.groups)) {
      return parsed.groups.map((g: any) => String(g)).filter(Boolean).slice(0, 6);
    }
    return [];
  } catch (err) {
    console.error('Failed to infer group options', err);
    return [];
  }
}

async function createProfileFromRows(
  rows: any[],
  profileId: string
): Promise<DatasetProfile> {
  const fields = extractFieldNames(rows);
  const inferredGroups = await inferGroupOptions(rows, fields);
  const groupOptions = inferredGroups.length
    ? inferredGroups
    : [
      'Identification',
      'Image Properties',
      'Quality',
      'Detection',
      'Metadata',
      'Other'
    ];
  const fieldProfiles: Record<string, FieldProfile> = {};

  for (const fieldName of fields) {
    const samples = rows.slice(0, 3).map(row => row?.[fieldName]);
    fieldProfiles[fieldName] = await inferFieldProfile(fieldName, samples, groupOptions);
  }

  return {
    profile_id: profileId,
    fields: fieldProfiles,
    settings: DEFAULT_SETTINGS
  };
}

async function getUserProfilePath(profileId: string): Promise<string | null> {
  const userData = await getUserDataPath();
  if (!userData) return null;
  const userDir = `${userData}/${USER_PROFILE_DIR}`;
  await window.electron?.fs?.ensureDir?.(userDir);
  return `${userDir}/profile_${profileId}.yaml`;
}

async function userProfileExists(profileId: string): Promise<boolean> {
  const userData = await getUserDataPath();
  if (!userData) return false;
  const userDir = `${userData}/${USER_PROFILE_DIR}`;
  const res = await window.electron?.fs?.readDir?.(userDir);
  if (!res?.success) return false;
  return res.entries.some(entry => entry.isFile && entry.name === `profile_${profileId}.yaml`);
}

async function copyProfileToUser(profile: DatasetProfile): Promise<string | null> {
  const path = await getUserProfilePath(profile.profile_id);
  if (!path) return null;
  await writeYamlFile(path, profile);
  return path;
}

export async function resolveDatasetProfile(rows: any[]): Promise<ProfileLoadResult> {
  const fieldNames = extractFieldNames(rows);
  const profileId = computeProfileIdFromFields(fieldNames);
  const profiles = await loadProfiles();

  const existing = profiles.get(profileId);
  if (existing) {
    const userPath = await getUserProfilePath(profileId);
    const isUser = await userProfileExists(profileId);
    return { profile: existing, created: false, source: isUser ? 'user' : 'default', path: isUser ? userPath || undefined : undefined };
  }

  const createdProfile = await createProfileFromRows(rows, profileId);
  const filePath = await copyProfileToUser(createdProfile);

  return { profile: createdProfile, created: true, source: 'user', path: filePath || undefined };
}

export async function getCachedDatasetProfile(
  rows: any[]
): Promise<{ profile: DatasetProfile; source: 'default' | 'user'; path?: string } | null> {
  const fieldNames = extractFieldNames(rows);
  const profileId = computeProfileIdFromFields(fieldNames);
  const profiles = await loadProfiles();
  const existing = profiles.get(profileId);
  if (!existing) return null;

  const userPath = await getUserProfilePath(profileId);
  const isUser = await userProfileExists(profileId);
  return {
    profile: existing,
    source: isUser ? 'user' : 'default',
    path: isUser ? userPath || undefined : undefined
  };
}

export async function updateProfileSettings(
  profile: DatasetProfile,
  source: 'default' | 'user'
): Promise<string | null> {
  const settings = profile.settings ?? DEFAULT_SETTINGS;
  const merged = { ...DEFAULT_SETTINGS, ...settings };
  const nextProfile = { ...profile, settings: merged };

  if (source === 'default') {
    return await copyProfileToUser(nextProfile);
  }

  const userPath = await getUserProfilePath(profile.profile_id);
  if (!userPath) return null;
  await writeYamlFile(userPath, nextProfile);
  return userPath;
}
