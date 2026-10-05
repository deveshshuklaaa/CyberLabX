$ErrorActionPreference = 'Continue'
Get-CimInstance Win32_Processor | Select-Object Name,NumberOfCores,NumberOfLogicalProcessors,VirtualizationFirmwareEnabled
Get-CimInstance Win32_ComputerSystem | Select-Object TotalPhysicalMemory,HypervisorPresent
Get-CimInstance Win32_OperatingSystem | Select-Object Caption,FreePhysicalMemory
Get-PSDrive -PSProvider FileSystem | Select-Object Name,Used,Free
Get-Command qemu-system-x86_64,qemu-img,docker,wsl -ErrorAction SilentlyContinue | Select-Object Name,Source
Get-NetAdapter -IncludeHidden | Select-Object Name,InterfaceDescription,Status
Get-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform
wsl --list --verbose
docker info --format '{{json .ServerVersion}}'
