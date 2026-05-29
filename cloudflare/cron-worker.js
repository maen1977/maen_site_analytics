// Not used in the GitHub Actions hosting-first setup.
// Daily frequency updates and daily email reports now run from:
// .github/workflows/maen-daily-automation.yml
// Keep this file only as a note so nobody accidentally deploys the old Cloudflare Cron Worker.
export default {
  async fetch() {
    return new Response('Cloudflare Cron Worker is disabled. GitHub Actions handles daily automation now.', {
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }
};
