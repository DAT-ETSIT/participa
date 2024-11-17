const router = require('express').Router();

const commitmentController = require('../controllers/commitmentController');
const middlewares = require('../middlewares');

router.use(middlewares.checkLogin);
router.use(middlewares.checkCandidate);

router.get('/proposals', commitmentController.getProposals);
router.get('/proposals/:id([a-f,0-9]{24})', commitmentController.getProposal);
router.post('/proposals/:id([a-f,0-9]{24})', commitmentController.saveCommitment);

module.exports = router;