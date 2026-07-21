#!/usr/bin/env ruby
# frozen_string_literal: true

require "date"
require "pathname"
require "set"
require "time"
require "uri"
require "yaml"

ROOT = Pathname.new(__dir__).parent.expand_path
ERRORS = []
WARNINGS = []

DATE_PATTERN = /\A\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?(?:\s*(?:Z|[+-]\d{2}:?\d{2}))?)?\z/
POST_FILENAME_PATTERN = /\A(\d{4}-\d{2}-\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md\z/
PROJECT_FILENAME_PATTERN = /\A([a-z0-9]+(?:-[a-z0-9]+)*)\.md\z/
PUBLISHED_PLACEHOLDERS = {
  /\[템플릿\]/i => "[템플릿] 표시",
  /\[초안 예시\]/i => "[초안 예시] 표시",
  /이 문서를 복사해/ => "템플릿 안내 문구",
  /실제 내용으로 교체/ => "교체 안내 문구",
  /확인된 작업 내용을 입력/ => "작업 입력 안내 문구",
  /https:\/\/example\.com/i => "example.com 예시 URL",
  /assets\/images\/파일이름/i => "예시 이미지 경로"
}.freeze

def relative(path)
  Pathname.new(path).expand_path.relative_path_from(ROOT).to_s.tr("\\", "/")
rescue ArgumentError
  path.to_s
end

def error(path, message)
  ERRORS << "#{relative(path)}: #{message}"
end

def warn(path, message)
  WARNINGS << "#{relative(path)}: #{message}"
end

def blank?(value)
  value.nil? || (value.respond_to?(:empty?) && value.empty?) || value.to_s.strip.empty?
end

def read_utf8(path)
  raw = File.binread(path)
  text = raw.force_encoding(Encoding::UTF_8)
  unless text.valid_encoding?
    error(path, "UTF-8로 읽을 수 없는 문자가 있습니다")
    return nil
  end
  text
rescue Errno::ENOENT
  error(path, "파일을 찾을 수 없습니다")
  nil
rescue StandardError => e
  error(path, "파일을 읽지 못했습니다 (#{e.class})")
  nil
end

def safe_yaml(source, path)
  YAML.safe_load(
    source,
    permitted_classes: [Date, Time],
    permitted_symbols: [],
    aliases: true,
    filename: relative(path)
  )
rescue Psych::Exception => e
  error(path, "YAML 문법 오류: #{e.message.lines.first.to_s.strip}")
  nil
end

def load_yaml_file(path)
  source = read_utf8(path)
  return nil unless source

  safe_yaml(source.sub(/\A\uFEFF/, ""), path)
end

def parse_front_matter(path)
  source = read_utf8(path)
  return nil unless source

  if source.start_with?("\uFEFF")
    error(path, "파일 맨 앞의 UTF-8 BOM을 제거하세요")
    source = source.sub(/\A\uFEFF/, "")
  end

  normalized = source.gsub("\r\n", "\n")
  match = normalized.match(/\A---[ \t]*\n(.*?)\n---[ \t]*(?:\n|\z)/m)
  unless match
    error(path, "YAML front matter가 --- 구분선으로 시작하고 끝나야 합니다")
    return nil
  end

  attributes = safe_yaml(match[1], path)
  unless attributes.is_a?(Hash)
    error(path, "front matter 최상위 값은 key/value 객체여야 합니다") unless attributes.nil?
    return nil
  end

  [attributes.transform_keys(&:to_s), normalized[match.end(0)..].to_s, normalized]
end

def valid_date?(value)
  return true if value.is_a?(Date) || value.is_a?(Time)
  return false unless value.is_a?(String) && value.strip.match?(DATE_PATTERN)

  DateTime.parse(value)
  true
rescue ArgumentError
  false
end

def date_prefix(value)
  return value.strftime("%Y-%m-%d") if value.respond_to?(:strftime)

  value.to_s.strip[0, 10]
end

def validate_string_array(value, path, field, required: false)
  if value.nil?
    warn(path, "#{field}가 없습니다; 빈 배열 []이라도 명시하면 관리하기 쉽습니다") if required
    return
  end
  unless value.is_a?(Array)
    error(path, "#{field}는 YAML 배열이어야 합니다")
    return
  end

  value.each_with_index do |item, index|
    error(path, "#{field}[#{index}]는 비어 있지 않은 문자열이어야 합니다") unless item.is_a?(String) && !item.strip.empty?
  end
end

def validate_https_url(value, path, field, allow_internal: false, allow_mailto: false)
  return if blank?(value)
  unless value.is_a?(String)
    error(path, "#{field} URL은 문자열이어야 합니다")
    return
  end

  url = value.strip
  return if allow_internal && url.start_with?("/") && !url.start_with?("//")
  return if allow_mailto && url.match?(/\Amailto:[^\s@]+@[^\s@]+\z/i)

  uri = URI.parse(url)
  unless uri.is_a?(URI::HTTPS) && uri.host && !uri.host.empty? && uri.userinfo.nil?
    error(path, "#{field}는 userinfo가 없는 전체 https URL이어야 합니다")
  end
rescue URI::InvalidURIError
  error(path, "#{field} URL 형식이 올바르지 않습니다")
end

def validate_markdown_urls(body, path)
  body.scan(/\]\((https?:\/\/[^\s)]+)(?:\s+["'][^"']*["'])?\)/i).flatten.each do |url|
    validate_https_url(url, path, "Markdown 외부 링크")
  end
end

def validate_cover(attributes, path)
  cover = attributes["cover"]
  alt = attributes["cover_alt"]
  if blank?(cover) && !blank?(attributes["thumbnail"])
    cover = attributes["thumbnail"]
    alt = attributes["thumbnail_alt"] if blank?(alt)
  end
  return if blank?(cover)

  unless cover.is_a?(String)
    error(path, "cover는 내부 경로 또는 전체 https URL 문자열이어야 합니다")
    return
  end

  if cover.match?(/\Ahttps?:\/\//i)
    validate_https_url(cover, path, "cover")
  else
    clean = cover.split(/[?#]/, 2).first.to_s.sub(%r{\A/+}, "")
    if clean.empty? || clean.split("/").any? { |part| part == "." || part == ".." }
      error(path, "cover 내부 경로가 올바르지 않습니다")
    elsif !ROOT.join(clean).file?
      error(path, "cover 파일을 찾을 수 없습니다: #{cover}")
    end
  end

  warn(path, "cover가 있으므로 내용을 설명하는 cover_alt를 입력하세요") if blank?(alt)
end

def published?(attributes, draft: false)
  return false if draft

  attributes.fetch("published", true) != false
end

def validate_common_document(path, attributes, body, raw, draft: false)
  if blank?(attributes["title"])
    error(path, "title이 필요합니다")
  elsif !attributes["title"].is_a?(String)
    error(path, "title은 문자열이어야 합니다")
  end

  card_description = blank?(attributes["description"]) ? attributes["summary"] : attributes["description"]
  if blank?(card_description)
    warn(path, "description 또는 summary가 없어 카드, 검색과 SEO 설명이 약해질 수 있습니다")
  elsif !card_description.is_a?(String)
    error(path, "description과 summary는 문자열이어야 합니다")
  end

  if attributes.key?("published") && ![true, false].include?(attributes["published"])
    error(path, "published는 true 또는 false여야 합니다")
  end
  if attributes.key?("noindex") && ![true, false].include?(attributes["noindex"])
    error(path, "noindex는 true 또는 false여야 합니다")
  end

  validate_cover(attributes, path)
  validate_markdown_urls(body, path)
  validate_https_url(attributes["canonical_url"], path, "canonical_url")

  return unless published?(attributes, draft: draft)

  PUBLISHED_PLACEHOLDERS.each do |pattern, label|
    error(path, "published: true 문서에 #{label}가 남아 있습니다") if raw.match?(pattern)
  end
  warn(path, "published: true 문서에 TODO 또는 TBD가 남아 있습니다") if raw.match?(/\b(?:TODO|TBD)\b/i)
end

permalinks = Hash.new { |hash, key| hash[key] = [] }
project_orders = Hash.new { |hash, key| hash[key] = [] }
series_orders = Hash.new { |hash, key| hash[key] = [] }

post_files = Dir.glob(ROOT.join("_posts", "**", "*.md").to_s).sort
draft_files = Dir.glob(ROOT.join("_drafts", "**", "*.md").to_s).sort
project_files = Dir.glob(ROOT.join("_projects", "**", "*.md").to_s).sort

(post_files + draft_files).each do |file|
  parsed = parse_front_matter(file)
  next unless parsed

  attributes, body, raw = parsed
  draft = Pathname.new(file).each_filename.include?("_drafts")
  validate_common_document(file, attributes, body, raw, draft: draft)

  unless valid_date?(attributes["date"])
    error(file, "date가 없거나 YYYY-MM-DD 또는 시간대 포함 날짜 형식이 아닙니다")
  end
  if attributes.key?("last_modified_at") && !blank?(attributes["last_modified_at"]) && !valid_date?(attributes["last_modified_at"])
    error(file, "last_modified_at 날짜 형식이 올바르지 않습니다")
  end
  validate_string_array(attributes["categories"], file, "categories", required: true)
  validate_string_array(attributes["tags"], file, "tags", required: true)

  if !blank?(attributes["series_order"]) && (!attributes["series_order"].is_a?(Integer) || attributes["series_order"] < 1)
    error(file, "series_order는 1 이상의 정수여야 합니다")
  end
  if blank?(attributes["series"]) && !blank?(attributes["series_order"])
    warn(file, "series_order가 있지만 series가 비어 있습니다")
  elsif !blank?(attributes["series"]) && blank?(attributes["series_order"])
    warn(file, "series가 있으므로 series_order를 입력하세요")
  end

  next if draft

  filename_match = File.basename(file).match(POST_FILENAME_PATTERN)
  unless filename_match
    error(file, "게시글 파일명은 YYYY-MM-DD-영문-슬러그.md 형식이어야 합니다")
    next
  end
  if valid_date?(attributes["date"]) && date_prefix(attributes["date"]) != filename_match[1]
    error(file, "파일명 날짜 #{filename_match[1]}와 front matter date #{date_prefix(attributes["date"])}가 다릅니다")
  end

  if published?(attributes) && !blank?(attributes["series"]) && attributes["series_order"].is_a?(Integer) && attributes["series_order"] >= 1
    series_orders[[attributes["series"].to_s.strip, attributes["series_order"]]] << file
  end

  permalink = attributes["permalink"]
  if blank?(permalink)
    year, month, day = filename_match[1].split("-")
    permalink = "/blog/#{year}/#{month}/#{day}/#{filename_match[2]}/"
  end
  permalinks[permalink.to_s] << file
end

project_files.each do |file|
  parsed = parse_front_matter(file)
  next unless parsed

  attributes, body, raw = parsed
  validate_common_document(file, attributes, body, raw)
  validate_string_array(attributes["technologies"], file, "technologies")
  validate_string_array(attributes["related_posts"], file, "related_posts")
  validate_https_url(attributes["repository_url"], file, "repository_url")
  validate_https_url(attributes["demo_url"], file, "demo_url")

  filename_match = File.basename(file).match(PROJECT_FILENAME_PATTERN)
  unless filename_match
    error(file, "프로젝트 파일명은 소문자 영문·숫자·하이픈.md 형식이어야 합니다")
    next
  end

  order = attributes["order"]
  if order.nil?
    warn(file, "order가 없어 프로젝트 정렬이 명확하지 않습니다")
  elsif !order.is_a?(Integer)
    error(file, "order는 정수여야 합니다")
  else
    project_orders[order] << file
  end

  permalink = attributes["permalink"]
  permalink = "/projects/#{filename_match[1]}/" if blank?(permalink)
  permalinks[permalink.to_s] << file
end

Dir.glob(ROOT.join("*.{md,html}").to_s).sort.each do |file|
  source = read_utf8(file)
  next unless source&.sub(/\A\uFEFF/, "")&.start_with?("---")

  parsed = parse_front_matter(file)
  next unless parsed

  attributes = parsed[0]
  permalinks[attributes["permalink"].to_s] << file unless blank?(attributes["permalink"])
end

permalinks.each do |permalink, files|
  next if permalink.empty? || files.size < 2

  files.each { |file| error(file, "중복 permalink #{permalink} (#{files.map { |item| relative(item) }.join(", ")})") }
end

project_orders.each do |order, files|
  next if files.size < 2

  files.each { |file| error(file, "프로젝트 order #{order}가 중복됩니다 (#{files.map { |item| relative(item) }.join(", ")})") }
end

series_orders.each do |(series, order), files|
  next if files.size < 2

  files.each { |file| error(file, "시리즈 #{series.inspect}의 series_order #{order}가 중복됩니다 (#{files.map { |item| relative(item) }.join(", ")})") }
end

data_files = Dir.glob(ROOT.join("_data", "*.yml").to_s).sort
data = {}
data_files.each do |file|
  data[File.basename(file, ".yml")] = load_yaml_file(file)
end

profile_path = ROOT.join("_data", "profile.yml")
profile = data["profile"]
if profile.is_a?(Hash)
  %w[github linkedin resume_url].each do |field|
    validate_https_url(profile[field], profile_path, field, allow_internal: field == "resume_url")
  end
  unless blank?(profile["email"]) || profile["email"].to_s.match?(/\A[^\s@]+@[^\s@]+\z/)
    error(profile_path, "email 형식이 올바르지 않습니다")
  end
end

navigation_path = ROOT.join("_data", "navigation.yml")
Array(data["navigation"]).each_with_index do |item, index|
  next unless item.is_a?(Hash)

  validate_https_url(item["url"], navigation_path, "navigation[#{index}].url", allow_internal: true)
end

social_path = ROOT.join("_data", "social.yml")
Array(data["social"]).each_with_index do |item, index|
  next unless item.is_a?(Hash)

  validate_https_url(item["url"], social_path, "social[#{index}].url")
end

categories_path = ROOT.join("_data", "categories.yml")
categories_config = data["categories"]
if categories_config.is_a?(Array)
  category_names = Hash.new { |hash, key| hash[key] = [] }
  category_orders = Hash.new { |hash, key| hash[key] = [] }
  categories_config.each_with_index do |item, index|
    unless item.is_a?(Hash)
      error(categories_path, "categories[#{index}]는 key/value 객체여야 합니다")
      next
    end
    name = item["name"].to_s.strip
    order = item["order"]
    error(categories_path, "categories[#{index}].name이 필요합니다") if name.empty?
    error(categories_path, "categories[#{index}].order는 0 이상의 정수여야 합니다") unless order.is_a?(Integer) && order >= 0
    category_names[name] << index unless name.empty?
    category_orders[order] << index if order.is_a?(Integer)
  end
  category_names.each { |name, indexes| error(categories_path, "카테고리 이름 #{name.inspect}이 중복됩니다") if indexes.size > 1 }
  category_orders.each { |order, indexes| error(categories_path, "카테고리 order #{order}가 중복됩니다") if indexes.size > 1 }
else
  error(categories_path, "categories.yml 최상위 값은 배열이어야 합니다")
end

site_path = ROOT.join("_data", "site.yml")
site_config = data["site"]
if site_config.is_a?(Hash)
  unless %w[light dark system].include?(site_config["default_theme"].to_s)
    error(site_path, "default_theme은 light, dark, system 중 하나여야 합니다")
  end
  %w[posts_per_page featured_posts_limit recent_posts_limit related_posts_limit search_results_limit].each do |field|
    value = site_config[field]
    error(site_path, "#{field}는 1 이상의 정수여야 합니다") unless value.is_a?(Integer) && value.positive?
  end
  features = site_config["features"]
  if features.is_a?(Hash)
    features.each do |name, value|
      error(site_path, "features.#{name}은 true 또는 false여야 합니다") unless [true, false].include?(value)
    end
  else
    error(site_path, "features는 key/value 객체여야 합니다")
  end
end

integrations_path = ROOT.join("_data", "integrations.yml")
integrations = data["integrations"]
if integrations.is_a?(Hash)
  giscus = integrations["giscus"]
  if giscus.is_a?(Hash) && giscus["enabled"] == true
    %w[repo repo_id category category_id mapping strict reactions_enabled input_position lang].each do |field|
      error(integrations_path, "giscus.enabled가 true이므로 giscus.#{field}가 필요합니다") if blank?(giscus[field])
    end
    error(integrations_path, "giscus.repo는 owner/repository 형식이어야 합니다") unless giscus["repo"].to_s.match?(/\A[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\z/)
  end

  analytics = integrations["analytics"]
  if analytics.is_a?(Hash) && analytics["enabled"] == true
    provider = analytics["provider"].to_s
    case provider
    when "google"
      error(integrations_path, "Google Analytics를 켰으므로 google_measurement_id가 필요합니다") if blank?(analytics["google_measurement_id"])
    when "umami"
      error(integrations_path, "Umami를 켰으므로 umami_website_id가 필요합니다") if blank?(analytics["umami_website_id"])
      validate_https_url(analytics["umami_script_url"], integrations_path, "analytics.umami_script_url")
      error(integrations_path, "Umami를 켰으므로 umami_script_url이 필요합니다") if blank?(analytics["umami_script_url"])
    when "plausible"
      error(integrations_path, "Plausible을 켰으므로 plausible_domain이 필요합니다") if blank?(analytics["plausible_domain"])
      validate_https_url(analytics["plausible_script_url"], integrations_path, "analytics.plausible_script_url")
      error(integrations_path, "Plausible을 켰으므로 plausible_script_url이 필요합니다") if blank?(analytics["plausible_script_url"])
    else
      error(integrations_path, "analytics.provider는 google, umami, plausible 중 하나여야 합니다")
    end
  end

  validate_https_url(integrations["newsletter_url"], integrations_path, "newsletter_url")
  validate_https_url(integrations["contact_form_url"], integrations_path, "contact_form_url")

  features = site_config.is_a?(Hash) && site_config["features"].is_a?(Hash) ? site_config["features"] : {}
  warn(integrations_path, "features.comments가 true지만 giscus.enabled가 true가 아닙니다") if features["comments"] == true && (!giscus.is_a?(Hash) || giscus["enabled"] != true)
  warn(integrations_path, "features.analytics가 true지만 analytics.enabled가 true가 아닙니다") if features["analytics"] == true && (!analytics.is_a?(Hash) || analytics["enabled"] != true)
end

editor_path = ROOT.join("_data", "editor.yml")
editor = data["editor"]
if editor.is_a?(Hash) && editor["enabled"] == true
  validate_https_url(editor["api_base_url"], editor_path, "api_base_url")
  error(editor_path, "편집기를 켰으므로 api_base_url이 필요합니다") if blank?(editor["api_base_url"])
  error(editor_path, "편집기를 켰으므로 owner_login이 필요합니다") if blank?(editor["owner_login"])
  error(editor_path, "편집기를 켰으므로 repository가 owner/repository 형식이어야 합니다") unless editor["repository"].to_s.match?(/\A[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\z/)
end

WARNINGS.sort.each { |message| puts "[WARN]  #{message}" }
ERRORS.sort.each { |message| puts "[ERROR] #{message}" }

puts
puts "Content validation: #{ERRORS.size} error(s), #{WARNINGS.size} warning(s)"
exit(ERRORS.empty? ? 0 : 1)
