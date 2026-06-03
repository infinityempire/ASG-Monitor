#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ASG Monitor - AWS Auto Scaling Group Monitor
 * Monitors ASG health, instance status, and capacity metrics
 */

class ASGMonitor {
    constructor(configPath = './monitor.config.json') {
        this.configPath = path.resolve(configPath);
        this.config = null;
        this.metrics = {
            timestamp: null,
            asgName: null,
            instanceCount: 0,
            healthyInstances: 0,
            unhealthyInstances: 0,
            desiredCapacity: 0,
            minSize: 0,
            maxSize: 0,
            status: 'unknown',
            lastCheck: null,
            alerts: []
        };
        this.logger = this.createLogger();
    }

    /**
     * Create a logger instance
     */
    createLogger() {
        return {
            info: (msg, data) => {
                const timestamp = new Date().toISOString();
                console.log(`[${timestamp}] ℹ️  INFO: ${msg}`, data || '');
            },
            warn: (msg, data) => {
                const timestamp = new Date().toISOString();
                console.warn(`[${timestamp}] ⚠️  WARN: ${msg}`, data || '');
            },
            error: (msg, data) => {
                const timestamp = new Date().toISOString();
                console.error(`[${timestamp}] ❌ ERROR: ${msg}`, data || '');
            },
            success: (msg, data) => {
                const timestamp = new Date().toISOString();
                console.log(`[${timestamp}] ✅ SUCCESS: ${msg}`, data || '');
            }
        };
    }

    /**
     * Load configuration from JSON file
     */
    loadConfig() {
        try {
            if (!fs.existsSync(this.configPath)) {
                this.logger.error(`Config file not found: ${this.configPath}`);
                this.createDefaultConfig();
                return false;
            }

            const configData = fs.readFileSync(this.configPath, 'utf-8');
            this.config = JSON.parse(configData);
            this.logger.success('Configuration loaded', this.config.asgName);
            return true;
        } catch (error) {
            this.logger.error('Failed to load configuration', error.message);
            return false;
        }
    }

    /**
     * Create default configuration file
     */
    createDefaultConfig() {
        const defaultConfig = {
            asgName: 'my-asg',
            region: 'eu-west-1',
            checkInterval: 60000,
            alertThresholds: {
                unhealthyInstancesLimit: 1,
                capacityUtilization: 80,
                responseTimeMs: 5000
            },
            monitoring: {
                checkHealth: true,
                checkCapacity: true,
                checkMetrics: true,
                verbose: false
            },
            notifications: {
                enableEmail: false,
                emailTo: 'ops@example.com',
                enableWebhook: false,
                webhookUrl: 'https://hooks.example.com/alerts'
            }
        };

        fs.writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2));
        this.logger.info('Default configuration created', this.configPath);
        this.config = defaultConfig;
    }

    /**
     * Simulate fetching ASG status from AWS
     */
    async fetchASGStatus() {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    asgName: this.config.asgName,
                    desiredCapacity: 3,
                    minSize: 1,
                    maxSize: 10,
                    instances: [
                        { instanceId: 'i-001', state: 'running', healthStatus: 'Healthy' },
                        { instanceId: 'i-002', state: 'running', healthStatus: 'Healthy' },
                        { instanceId: 'i-003', state: 'running', healthStatus: 'Healthy' }
                    ]
                });
            }, 1000);
        });
    }

    /**
     * Simulate fetching CloudWatch metrics
     */
    async fetchMetrics() {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    cpuUtilization: 45.2,
                    networkIn: 1024000,
                    networkOut: 2048000,
                    diskReadOps: 500,
                    diskWriteOps: 300
                });
            }, 500);
        });
    }

    /**
     * Check health of ASG and instances
     */
    async checkHealth() {
        try {
            this.logger.info('Checking ASG health...');
            const status = await this.fetchASGStatus();

            this.metrics.asgName = status.asgName;
            this.metrics.desiredCapacity = status.desiredCapacity;
            this.metrics.minSize = status.minSize;
            this.metrics.maxSize = status.maxSize;
            this.metrics.instanceCount = status.instances.length;

            const healthy = status.instances.filter(i => i.healthStatus === 'Healthy').length;
            const unhealthy = status.instances.length - healthy;

            this.metrics.healthyInstances = healthy;
            this.metrics.unhealthyInstances = unhealthy;

            // Check for alerts
            this.metrics.alerts = [];
            if (unhealthy > this.config.alertThresholds.unhealthyInstancesLimit) {
                this.metrics.alerts.push({
                    severity: 'high',
                    message: `⚠️ ${unhealthy} unhealthy instances detected`
                });
                this.logger.warn(`Unhealthy instances detected: ${unhealthy}`);
            }

            if (healthy === status.instances.length) {
                this.metrics.status = 'healthy';
                this.logger.success(`All ${healthy} instances are healthy`);
            } else {
                this.metrics.status = 'degraded';
                this.logger.warn(`ASG degraded: ${healthy}/${status.instances.length} healthy`);
            }

            return true;
        } catch (error) {
            this.logger.error('Health check failed', error.message);
            this.metrics.status = 'error';
            return false;
        }
    }

    /**
     * Check capacity utilization
     */
    async checkCapacity() {
        try {
            this.logger.info('Checking capacity...');
            const utilized = (this.metrics.instanceCount / this.metrics.maxSize) * 100;

            if (utilized > this.config.alertThresholds.capacityUtilization) {
                this.metrics.alerts.push({
                    severity: 'medium',
                    message: `⚠️ Capacity utilization at ${utilized.toFixed(1)}%`
                });
                this.logger.warn(`High capacity utilization: ${utilized.toFixed(1)}%`);
            } else {
                this.logger.info(`Capacity utilization: ${utilized.toFixed(1)}%`);
            }

            return true;
        } catch (error) {
            this.logger.error('Capacity check failed', error.message);
            return false;
        }
    }

    /**
     * Fetch and log metrics
     */
    async checkMetrics() {
        try {
            this.logger.info('Fetching CloudWatch metrics...');
            const metrics = await this.fetchMetrics();
            
            this.logger.info('📊 Metrics snapshot:');
            console.log(`   CPU Utilization: ${metrics.cpuUtilization}%`);
            console.log(`   Network In: ${(metrics.networkIn / 1024).toFixed(2)} KB`);
            console.log(`   Network Out: ${(metrics.networkOut / 1024).toFixed(2)} KB`);
            console.log(`   Disk Read Ops: ${metrics.diskReadOps}`);
            console.log(`   Disk Write Ops: ${metrics.diskWriteOps}`);

            return true;
        } catch (error) {
            this.logger.error('Metrics fetch failed', error.message);
            return false;
        }
    }

    /**
     * Send webhook notification
     */
    async sendWebhookNotification() {
        if (!this.config.notifications.enableWebhook) {
            return;
        }

        try {
            const payload = JSON.stringify(this.metrics);
            this.logger.info('Sending webhook notification...');
            
            // Simulate webhook send
            setTimeout(() => {
                this.logger.success('Webhook notification sent');
            }, 500);
        } catch (error) {
            this.logger.error('Webhook notification failed', error.message);
        }
    }

    /**
     * Send email notification
     */
    async sendEmailNotification() {
        if (!this.config.notifications.enableEmail) {
            return;
        }

        if (this.metrics.alerts.length === 0) {
            return;
        }

        try {
            this.logger.info(`Sending email to ${this.config.notifications.emailTo}...`);
            
            // Simulate email send
            setTimeout(() => {
                this.logger.success('Email notification sent');
            }, 500);
        } catch (error) {
            this.logger.error('Email notification failed', error.message);
        }
    }

    /**
     * Run monitoring cycle
     */
    async run() {
        this.metrics.timestamp = new Date().toISOString();
        this.metrics.lastCheck = new Date();

        this.logger.info(`\n🔍 Starting monitoring cycle for ASG: ${this.config.asgName}`);
        console.log('─'.repeat(60));

        // Run checks
        if (this.config.monitoring.checkHealth) {
            await this.checkHealth();
        }

        if (this.config.monitoring.checkCapacity) {
            await this.checkCapacity();
        }

        if (this.config.monitoring.checkMetrics) {
            await this.checkMetrics();
        }

        // Send notifications if there are alerts
        if (this.metrics.alerts.length > 0) {
            console.log('\n' + '─'.repeat(60));
            this.logger.warn(`Found ${this.metrics.alerts.length} alert(s)`);
            this.metrics.alerts.forEach(alert => {
                console.log(`   ${alert.message} [${alert.severity.toUpperCase()}]`);
            });

            await this.sendWebhookNotification();
            await this.sendEmailNotification();
        }

        console.log('─'.repeat(60) + '\n');

        // Display summary
        this.printSummary();
    }

    /**
     * Print monitoring summary
     */
    printSummary() {
        console.log('\n📋 Monitoring Summary:');
        console.log(`   ASG Name: ${this.metrics.asgName}`);
        console.log(`   Status: ${this.metrics.status.toUpperCase()}`);
        console.log(`   Instances: ${this.metrics.healthyInstances}/${this.metrics.instanceCount} healthy`);
        console.log(`   Capacity: ${this.metrics.instanceCount}/${this.metrics.maxSize} (${((this.metrics.instanceCount / this.metrics.maxSize) * 100).toFixed(1)}%)`);
        console.log(`   Last Check: ${this.metrics.lastCheck.toLocaleString()}`);
        console.log(`   Alerts: ${this.metrics.alerts.length}`);
    }

    /**
     * Start continuous monitoring
     */
    startContinuous() {
        this.logger.success('Starting continuous monitoring');
        this.logger.info(`Check interval: ${this.config.checkInterval / 1000} seconds`);

        // Run immediately
        this.run();

        // Set up interval
        setInterval(() => {
            this.run();
        }, this.config.checkInterval);
    }

    /**
     * Export metrics to file
     */
    exportMetrics(filename = 'metrics.json') {
        try {
            const filepath = path.resolve(filename);
            fs.writeFileSync(filepath, JSON.stringify(this.metrics, null, 2));
            this.logger.success(`Metrics exported to ${filename}`);
        } catch (error) {
            this.logger.error('Failed to export metrics', error.message);
        }
    }
}

/**
 * Main execution
 */
async function main() {
    const monitor = new ASGMonitor();

    // Load configuration
    if (!monitor.loadConfig()) {
        console.log('\n⚠️  Using default configuration...\n');
    }

    // Run single check
    if (process.argv.includes('--once')) {
        await monitor.run();
        monitor.exportMetrics();
    } else {
        // Start continuous monitoring
        monitor.startContinuous();
    }
}

// Export for testing
export default ASGMonitor;

// Run if executed directly
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
