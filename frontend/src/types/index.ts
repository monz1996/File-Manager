export interface SystemStatus {
  connected: {
    local_root: { path: string; available: boolean };
    downloads: { path: string; available: boolean };
    remote_drive: { path: string; available: boolean };
    remote_old_but_gold: { path: string; available: boolean };
  };
  data_files: {
    file_index: DataFileInfo;
    video_metadata: DataFileInfo & { packages_count?: number };
    remote_catalog: DataFileInfo & { to_be_downloaded_count?: number };
    old_but_gold_diff: DataFileInfo;
  };
  operations_count: number;
}

export interface CurrentOperation {
  id: string;
  type: string;
  label: string;
  status: string;
  phase: string;
  processed: number;
  total: number;
  current_path?: string;
  started_at: string;
  stop_requested: boolean;
}

export interface DataFileInfo {
  exists: boolean;
  size_bytes: number;
  size_readable: string;
  modified_at: string | null;
  records_count?: number;
  description: string;
}

export interface OperationLog {
  id: string;
  timestamp: string;
  action_type: 'download_move' | 'local_rename' | 'drive_sync' | 'audit_rename' | string;
  source: string;
  destination: string;
  description: string;
  details: Record<string, any>;
  status: 'completed' | 'reverted' | 'failed';
  reverted_at?: string;
}

export interface VideoQuality {
  width: number | null;
  height: number | null;
  resolution: string | null;
  quality_label: string | null;
  aspect_ratio: string | null;
  estimated_total_bitrate_kbps: number | null;
}

export interface VideoEntry {
  name: string;
  path: string;
  extension: string;
  size_bytes: number;
  size_readable: string;
  duration_seconds: number | null;
  duration_readable: string | null;
  quality: VideoQuality;
  created_at: string;
  modified_at: string;
}

export interface VideoPackage {
  name: string;
  path: string;
  size_bytes: number;
  size_readable: string;
  video_size_bytes: number;
  video_size_readable: string;
  file_count: number;
  video_count: number;
  other_file_count: number;
  extensions: Record<string, number>;
  total_duration_seconds: number;
  total_duration_readable: string;
  videos_with_known_duration: number;
  videos_with_known_quality: number;
  quality_counts: Record<string, number>;
  videos: VideoEntry[];
  highest_quality_video?: {
    name: string;
    resolution: string;
    quality_label: string;
    size_readable: string;
    path: string;
  } | null;
  lowest_quality_video?: {
    name: string;
    resolution: string;
    quality_label: string;
    size_readable: string;
    path: string;
  } | null;
  highest_file_size_video?: {
    name: string;
    size_bytes: number;
    size_readable: string;
    resolution: string;
    quality_label: string;
    path: string;
  } | null;
  lowest_file_size_video?: {
    name: string;
    size_bytes: number;
    size_readable: string;
    resolution: string;
    quality_label: string;
    path: string;
  } | null;
  shortest_duration_video?: {
    name: string;
    duration_seconds: number | null;
    duration_readable: string | null;
    size_readable: string;
    quality_label: string;
    path: string;
  } | null;
  longest_duration_video?: {
    name: string;
    duration_seconds: number | null;
    duration_readable: string | null;
    size_readable: string;
    quality_label: string;
    path: string;
  } | null;
}

export interface VideoMetadataResponse {
  generated_at: string;
  source_folder: string;
  package_count: number;
  total_size_bytes: number;
  total_size_readable: string;
  video_file_count: number;
  total_duration_seconds: number;
  total_duration_readable: string;
  videos_with_known_quality: number;
  quality_counts: Record<string, number>;
  packages: VideoPackage[];
}

export interface DownloadPlanEntry {
  source_name: string;
  source_path: string;
  is_directory: boolean;
  size_bytes: number;
  recommended_package: string;
  recommended_name: string;
  recommended_relative_path: string;
  destination_path: string;
  destination_exists: boolean;
  name_changed: boolean;
  reason: string;
}

export interface DownloadsPlanResponse {
  generated_at: string;
  downloads_root: string;
  old_but_gold_root: string;
  downloads_available: boolean;
  old_but_gold_available: boolean;
  entry_count: number;
  ignored_count: number;
  entries: DownloadPlanEntry[];
  ignored: string[];
  available_packages: string[];
}

export interface OldGoldDiffPackage {
  package: string;
  local_available: boolean;
  remote_available: boolean;
  local_count: number;
  remote_count: number;
  only_local_count: number;
  only_remote_count: number;
  only_local: string[];
  only_remote: string[];
}

export interface OldGoldDiffResponse {
  generated_at: string;
  comparison: string;
  local_root: string;
  remote_root: string;
  local_root_available: boolean;
  remote_root_available: boolean;
  package_count: number;
  packages_with_differences_count: number;
  packages: OldGoldDiffPackage[];
}

export interface NameAuditIssue {
  kind: string;
  token?: string;
  suggestion?: string;
  message: string;
}

export interface NameAuditEntry {
  type: 'file' | 'package';
  folder: string;
  name: string;
  path: string;
  suggested_name?: string;
  issues: NameAuditIssue[];
}

export interface NameAuditResponse {
  scope: string;
  count: number;
  total_count: number;
  arabic_dictionary_check: string;
  arabic_note: string;
  issues: NameAuditEntry[];
  ignored_count: number;
}
