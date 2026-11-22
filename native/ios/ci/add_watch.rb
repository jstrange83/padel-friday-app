# Lægger Apple Watch-appen (PadelWatch) ind i Xcode-projektet, så den bygges og følger med iPhone-appen.
# Køres i CI efter "cap sync" (xcodeproj følger med CocoaPods). Gør ingenting, hvis målet allerede findes.
require 'xcodeproj'

path = File.expand_path('../App/App.xcodeproj', __dir__)
project = Xcodeproj::Project.open(path)
if project.targets.any? { |t| t.name == 'PadelWatch' }
  puts 'PadelWatch findes allerede'
  exit 0
end
app = project.targets.find { |t| t.name == 'App' }

watch = project.new_target(:application, 'PadelWatch', :watchos, '10.0')
group = project.main_group.new_group('PadelWatch', 'PadelWatch')
sources = %w[PadelWatchApp ContentView Model Score Api].map { |n| "#{n}.swift" }.select { |f| File.exist?(File.join(File.dirname(path), 'PadelWatch', f)) }
refs = sources.map { |f| group.new_reference(f) }
watch.add_file_references(refs)
assets = group.new_reference('Assets.xcassets')
watch.resources_build_phase.add_file_reference(assets)
group.new_reference('Info.plist')

watch.build_configurations.each do |c|
  s = c.build_settings
  s['PRODUCT_BUNDLE_IDENTIFIER'] = 'dk.padelklubben.app.watchkitapp'
  s['PRODUCT_NAME'] = '$(TARGET_NAME)'
  s['INFOPLIST_FILE'] = 'PadelWatch/Info.plist'
  s['GENERATE_INFOPLIST_FILE'] = 'NO'
  s['SDKROOT'] = 'watchos'
  s['WATCHOS_DEPLOYMENT_TARGET'] = '10.0'
  s['TARGETED_DEVICE_FAMILY'] = '4'
  s['SWIFT_VERSION'] = '5.0'
  s['ASSETCATALOG_COMPILER_APPICON_NAME'] = 'AppIcon'
  s['ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME'] = 'AccentColor'
  s['CODE_SIGN_STYLE'] = 'Automatic'
  s['SKIP_INSTALL'] = 'YES'
  s['MARKETING_VERSION'] = '1.0'
  s['CURRENT_PROJECT_VERSION'] = '1'
  s['ENABLE_PREVIEWS'] = 'NO'
  s['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks']
end

# iPhone-appen afhænger af uret og lægger det i "Watch"-mappen
app.add_dependency(watch)
embed = app.new_copy_files_build_phase('Embed Watch Content')
embed.dst_subfolder_spec = '16'
embed.dst_path = '$(CONTENTS_FOLDER_PATH)/Watch'
bf = embed.add_file_reference(watch.product_reference, true)
bf.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

project.save
puts 'PadelWatch lagt ind i projektet'
