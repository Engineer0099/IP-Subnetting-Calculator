document.addEventListener('DOMContentLoaded', function() {
    const ipAddressInput = document.getElementById('ipAddress');
    const subnetMaskInput = document.getElementById('subnetMask');
    const subnetsNeededInput = document.getElementById('subnetsNeeded');
    const hostsNeededInput = document.getElementById('hostsNeeded');
    const usableHostsNeededInput = document.getElementById('usableHostsNeeded');
    const calculateBtn = document.getElementById('calculateBtn');
    const lookupBtn = document.getElementById('lookupBtn');
    
    const useSubnetMaskCheckbox = document.getElementById('useSubnetMask');
    const useSubnetsCheckbox = document.getElementById('useSubnets');
    const useHostsCheckbox = document.getElementById('useHosts');
    const useUsableHostsCheckbox = document.getElementById('useUsableHosts');
    
    // Variables to store calculated subnet information
    let subnetData = {
        ipClass: '',
        defaultMask: '',
        customMask: '',
        customCidr: 0,
        borrowedBits: 0,
        totalSubnets: 0,
        subnetSize: 0,
        networkAddress: '',
        firstOctet: 0,
        ipParts: []
    };
    
    // Toggle input fields based on checkbox selection
    useSubnetMaskCheckbox.addEventListener('change', function() {
        subnetMaskInput.disabled = !this.checked;
        if (!this.checked) subnetMaskInput.value = '';
    });
    
    useSubnetsCheckbox.addEventListener('change', function() {
        subnetsNeededInput.disabled = !this.checked;
        if (!this.checked) subnetsNeededInput.value = '';
    });
    
    useHostsCheckbox.addEventListener('change', function() {
        hostsNeededInput.disabled = !this.checked;
        if (!this.checked) hostsNeededInput.value = '';
    });
    
    useUsableHostsCheckbox.addEventListener('change', function() {
        usableHostsNeededInput.disabled = !this.checked;
        if (!this.checked) usableHostsNeededInput.value = '';
    });
    
    calculateBtn.addEventListener('click', calculateSubnet);
    lookupBtn.addEventListener('click', performSubnetLookup);
    
    function calculateSubnet() {
        // Clear previous results
        clearResults();
        
        // Get input values
        const ipAddress = ipAddressInput.value.trim();
        const subnetMask = subnetMaskInput.value.trim();
        const subnetsNeeded = parseInt(subnetsNeededInput.value) || 0;
        const hostsNeeded = parseInt(hostsNeededInput.value) || 0;
        const usableHostsNeeded = parseInt(usableHostsNeededInput.value) || 0;
        
        // Validate IP address
        if (!isValidIP(ipAddress)) {
            showError('Please enter a valid IP address');
            return;
        }
        
        // Validate that at least one option is selected
        const optionsSelected = useSubnetMaskCheckbox.checked || useSubnetsCheckbox.checked || 
                              useHostsCheckbox.checked || useUsableHostsCheckbox.checked;
        
        if (!optionsSelected) {
            showError('Please select at least one calculation option');
            return;
        }
        
        // Parse IP address
        subnetData.ipParts = ipAddress.split('.').map(part => parseInt(part));
        subnetData.firstOctet = subnetData.ipParts[0];
        
        // Determine IP class and default mask
        if (subnetData.firstOctet >= 1 && subnetData.firstOctet <= 126) {
            subnetData.ipClass = 'A';
            subnetData.defaultMask = '255.0.0.0';
            subnetData.defaultCidr = 8;
        } else if (subnetData.firstOctet >= 128 && subnetData.firstOctet <= 191) {
            subnetData.ipClass = 'B';
            subnetData.defaultMask = '255.255.0.0';
            subnetData.defaultCidr = 16;
        } else if (subnetData.firstOctet >= 192 && subnetData.firstOctet <= 223) {
            subnetData.ipClass = 'C';
            subnetData.defaultMask = '255.255.255.0';
            subnetData.defaultCidr = 24;
        } else if (subnetData.firstOctet >= 224 && subnetData.firstOctet <= 239) {
            subnetData.ipClass = 'D (Multicast)';
            subnetData.defaultMask = 'N/A';
            subnetData.defaultCidr = -1;
        } else {
            subnetData.ipClass = 'E (Experimental)';
            subnetData.defaultMask = 'N/A';
            subnetData.defaultCidr = -1;
        }
        
        // Display IP class and default mask
        document.getElementById('ipClass').textContent = subnetData.ipClass;
        document.getElementById('defaultMask').textContent = `${subnetData.defaultMask} (/${subnetData.defaultCidr})`;
        
        // Calculate based on provided inputs
        if (useSubnetMaskCheckbox.checked && subnetMask) {
            // User provided subnet mask
            if (subnetMask.startsWith('/')) {
                subnetData.customCidr = parseInt(subnetMask.substring(1));
                if (isNaN(subnetData.customCidr) || subnetData.customCidr < 0 || subnetData.customCidr > 32) {
                    showError('Invalid CIDR notation (must be between 0 and 32)');
                    return;
                }
                subnetData.customMask = cidrToMask(subnetData.customCidr);
            } else {
                if (!isValidIP(subnetMask)) {
                    showError('Invalid subnet mask format');
                    return;
                }
                subnetData.customMask = subnetMask;
                subnetData.customCidr = maskToCidr(subnetMask);
                if (subnetData.customCidr === -1) {
                    showError('Invalid subnet mask');
                    return;
                }
            }
        } else if (useSubnetsCheckbox.checked && subnetsNeeded > 0) {
            // Calculate based on subnets needed
            const bitsNeeded = Math.ceil(Math.log2(subnetsNeeded));
            subnetData.customCidr = subnetData.defaultCidr + bitsNeeded;
            if (subnetData.customCidr > 30) { // Practical limit for IPv4
                showError('Too many subnets requested for this IP class');
                return;
            }
            subnetData.customMask = cidrToMask(subnetData.customCidr);
        } else if (useHostsCheckbox.checked && hostsNeeded > 0) {
            // Calculate based on hosts needed
            const bitsNeeded = Math.ceil(Math.log2(hostsNeeded)); // +2 for network and broadcast
            subnetData.customCidr = 32 - bitsNeeded;
            if (subnetData.customCidr < subnetData.defaultCidr) {
                showError('Not enough host bits available for this IP class');
                return;
            }
            subnetData.customMask = cidrToMask(subnetData.customCidr);
        } else if (useUsableHostsCheckbox.checked && usableHostsNeeded > 0) {
            // Calculate based on usable hosts needed
            const bitsNeeded = Math.ceil(Math.log2(usableHostsNeeded + 2)); // +2 for network and broadcast
            subnetData.customCidr = 32 - bitsNeeded;
            if (subnetData.customCidr < subnetData.defaultCidr) {
                showError('Not enough host bits available for this IP class');
                return;
            }
            subnetData.customMask = cidrToMask(subnetData.customCidr);
        } else {
            showError('Please provide valid input for at least one option');
            return;
        }
        
        // Calculate subnet information
        subnetData.borrowedBits = subnetData.customCidr - subnetData.defaultCidr;
        subnetData.totalSubnets = Math.pow(2, subnetData.borrowedBits);
        const hostBits = 32 - subnetData.customCidr;
        const hostsPerSubnet = Math.pow(2, hostBits);
        const usableHostsPerSubnet = hostsPerSubnet - 2; // Subtract network and broadcast
        
        // Calculate network address, first/last host, and broadcast
        subnetData.networkAddress = calculateNetworkAddress(ipAddress, subnetData.customMask);
        const firstHost = calculateFirstHost(subnetData.networkAddress);
        const lastHost = calculateLastHost(subnetData.networkAddress, subnetData.customMask);
        const broadcastAddress = calculateBroadcastAddress(subnetData.networkAddress, subnetData.customMask);
        
        // Calculate subnet size
        subnetData.subnetSize = Math.pow(2, 32 - subnetData.customCidr);
        
        // Display results
        document.getElementById('customMask').textContent = `${subnetData.customMask} (/${subnetData.customCidr})`;
        document.getElementById('borrowedBits').textContent = subnetData.borrowedBits > 0 ? subnetData.borrowedBits : '0 (No subnetting)';
        document.getElementById('totalSubnets').textContent = subnetData.totalSubnets;
        document.getElementById('hostsPerSubnet').textContent = hostsPerSubnet;
        document.getElementById('usableHosts').textContent = usableHostsPerSubnet >= 0 ? usableHostsPerSubnet : 'N/A';
        document.getElementById('networkAddress').textContent = subnetData.networkAddress;
        document.getElementById('firstHost').textContent = firstHost;
        document.getElementById('lastHost').textContent = lastHost;
        document.getElementById('broadcastAddress').textContent = broadcastAddress;
        
        // Generate and display subnet table
        generateSubnetTable();
    }
    
    function generateSubnetTable() {
        const tableBody = document.querySelector('#subnetDetailsTable tbody');
        tableBody.innerHTML = '';
        
        if (subnetData.totalSubnets <= 0) return;
        
        const showAll = subnetData.totalSubnets <= 8;
        const showEllipsis = subnetData.totalSubnets > 8;
        const displayCount = Math.min(4, subnetData.totalSubnets);
        
        // Calculate base network address as a number
        const baseNetwork = ipToNumber(subnetData.networkAddress);
        
        for (let i = 0; i < subnetData.totalSubnets; i++) {
            // Skip middle entries if we have many subnets
            if (showEllipsis && i >= displayCount && i < subnetData.totalSubnets - displayCount) {
                if (i === displayCount) {
                    // Add ellipsis row
                    const row = document.createElement('tr');
                    const cell = document.createElement('td');
                    cell.colSpan = 4;
                    cell.textContent = '...';
                    cell.style.textAlign = 'center';
                    row.appendChild(cell);
                    tableBody.appendChild(row);
                }
                continue;
            }
            
            const subnetNetworkNum = baseNetwork + i * subnetData.subnetSize;
            const subnetNetwork = numberToIp(subnetNetworkNum);
            const subnetBroadcast = numberToIp(subnetNetworkNum + subnetData.subnetSize - 1);
            const firstHost = numberToIp(subnetNetworkNum + 1);
            const lastHost = numberToIp(subnetNetworkNum + subnetData.subnetSize - 2);
            
            const row = document.createElement('tr');
            
            const subnetCell = document.createElement('td');
            subnetCell.textContent = i + 1;
            row.appendChild(subnetCell);
            
            const networkCell = document.createElement('td');
            networkCell.textContent = subnetNetwork;
            row.appendChild(networkCell);
            
            const rangeCell = document.createElement('td');
            rangeCell.textContent = `${firstHost} - ${lastHost}`;
            row.appendChild(rangeCell);
            
            const broadcastCell = document.createElement('td');
            broadcastCell.textContent = subnetBroadcast;
            row.appendChild(broadcastCell);
            
            tableBody.appendChild(row);
        }
        
        // Show the subnet table section
        document.getElementById('subnetTable').style.display = 'block';
    }
    
    function performSubnetLookup() {
        const subnetNumber = parseInt(document.getElementById('subnetNumber').value)- 1;
        const lookupType = document.getElementById('lookupType').value;
        const resultDiv = document.getElementById('lookupResult');
        
        if (isNaN(subnetNumber) || subnetNumber < 0 || subnetNumber >= subnetData.totalSubnets) {
            resultDiv.innerHTML = `<div class="error">Please enter a valid subnet number (1-${subnetData.totalSubnets})</div>`;
            return;
        }
        
        // Calculate base network address as a number
        const baseNetwork = ipToNumber(subnetData.networkAddress);
        const subnetNetworkNum = baseNetwork + subnetNumber * subnetData.subnetSize;
        
        const subnetNetwork = numberToIp(subnetNetworkNum);
        const subnetBroadcast = numberToIp(subnetNetworkNum + subnetData.subnetSize - 1);
        const firstHost = numberToIp(subnetNetworkNum + 1);
        const lastHost = numberToIp(subnetNetworkNum + subnetData.subnetSize - 2);
        
        let resultText = '';
        switch (lookupType) {
            case 'network':
                resultText = `Network Address: ${subnetNetwork}`;
                break;
            case 'usable':
                resultText = `Usable Range: ${firstHost} - ${lastHost}`;
                break;
            case 'broadcast':
                resultText = `Broadcast Address: ${subnetBroadcast}`;
                break;
            case 'all':
                resultText = `Subnet #${subnetNumber+1} Information:\n` +
                             `Network Address: ${subnetNetwork}\n` +
                             `Usable Range: ${firstHost} - ${lastHost}\n` +
                             `Broadcast Address: ${subnetBroadcast}`;
                break;
        }
        
        resultDiv.innerHTML = `<pre>${resultText}</pre>`;
    }
    
    // Helper functions
    function ipToNumber(ip) {
        return ip.split('.').reduce((acc, octet, idx) => acc + (parseInt(octet) << (8 * (3 - idx))), 0);
    }
    
    function numberToIp(num) {
        return [
            (num >>> 24) & 0xFF,
            (num >>> 16) & 0xFF,
            (num >>> 8) & 0xFF,
            num & 0xFF
        ].join('.');
    }
    
    function isValidIP(ip) {
        const parts = ip.split('.');
        if (parts.length !== 4) return false;
        
        for (const part of parts) {
            const num = parseInt(part);
            if (isNaN(num) || num < 0 || num > 255) return false;
        }
        
        return true;
    }
    
    function cidrToMask(cidr) {
        if (cidr < 0 || cidr > 32) return '0.0.0.0';
        
        let mask = [];
        for (let i = 0; i < 4; i++) {
            const bits = Math.min(8, cidr - i * 8);
            mask.push(bits > 0 ? (256 - Math.pow(2, 8 - bits)) : 0);
        }
        
        return mask.join('.');
    }
    
    function maskToCidr(mask) {
        const parts = mask.split('.');
        if (parts.length !== 4) return -1;
        
        let binary = '';
        for (const part of parts) {
            const num = parseInt(part);
            if (isNaN(num) || num < 0 || num > 255) return -1;
            binary += num.toString(2).padStart(8, '0');
        }
        
        // Validate that the mask is contiguous 1s followed by 0s
        const firstZero = binary.indexOf('0');
        if (firstZero === -1) return 32; // All 1s
        
        if (binary.substring(firstZero).includes('1')) return -1; // Invalid mask
        
        return firstZero;
    }
    
    function calculateNetworkAddress(ip, mask) {
        const ipParts = ip.split('.').map(part => parseInt(part));
        const maskParts = mask.split('.').map(part => parseInt(part));
        
        const networkParts = [];
        for (let i = 0; i < 4; i++) {
            networkParts.push(ipParts[i] & maskParts[i]);
        }
        
        return networkParts.join('.');
    }
    
    function calculateFirstHost(networkAddress) {
        const parts = networkAddress.split('.').map(part => parseInt(part));
        parts[3] += 1; // Increment last octet
        
        // Handle overflow
        for (let i = 3; i >= 0; i--) {
            if (parts[i] > 255) {
                parts[i] = 0;
                if (i > 0) parts[i-1]++;
            }
        }
        
        return parts.join('.');
    }
    
    function calculateLastHost(networkAddress, mask) {
        const broadcast = calculateBroadcastAddress(networkAddress, mask);
        const parts = broadcast.split('.').map(part => parseInt(part));
        parts[3] -= 1; // Decrement last octet
        
        // Handle underflow
        for (let i = 3; i >= 0; i--) {
            if (parts[i] < 0) {
                parts[i] = 255;
                if (i > 0) parts[i-1]--;
            }
        }
        
        return parts.join('.');
    }
    
    function calculateBroadcastAddress(networkAddress, mask) {
        const netParts = networkAddress.split('.').map(part => parseInt(part));
        const maskParts = mask.split('.').map(part => parseInt(part));
        
        const broadcastParts = [];
        for (let i = 0; i < 4; i++) {
            broadcastParts.push(netParts[i] | (~maskParts[i] & 0xFF));
        }
        
        return broadcastParts.join('.');
    }
    
    function clearResults() {
        const resultValues = document.querySelectorAll('.result-value');
        resultValues.forEach(el => el.textContent = '-');
        
        const errorElements = document.querySelectorAll('.error');
        errorElements.forEach(el => el.remove());
        
        document.getElementById('subnetTable').style.display = 'none';
        document.getElementById('lookupResult').innerHTML = '';
    }
    
    function showError(message) {
        clearResults();
        
        const errorElement = document.createElement('div');
        errorElement.className = 'error';
        errorElement.textContent = message;
        
        const inputSection = document.querySelector('.input-section');
        inputSection.appendChild(errorElement);
    }
});